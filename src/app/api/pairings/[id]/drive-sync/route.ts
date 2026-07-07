import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { loadAuth } from "@/lib/integrations/google-calendar";
import {
  makeDriveClient,
  ensureRootFolder,
  ensureFolder,
  uploadIfMissing,
  folderWebUrl,
} from "@/lib/integrations/google-drive";

/**
 * POST /api/pairings/[id]/drive-sync — admin-only.
 *
 * Pushes every mentor-APPROVED document of this pairing's mentee into the SatuTuju
 * Google Drive under a folder named after the student's legal name.
 * Idempotent: files that already exist in the folder (same name) are
 * skipped, so re-syncing after new uploads only adds what's new.
 */

// Drive round-trips + file transfers take longer than the default budget.
export const maxDuration = 60;

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Tanpa Nama";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin yang bisa sync ke Drive." }, { status: 403 });
  }

  const { id } = await params;

  // Google connection + Drive scope check (grant predates the drive.file
  // scope until the admin re-authorizes).
  const auth = await loadAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Google belum terhubung. Buka /api/auth/google untuk menghubungkan akun admin@satutuju.id." },
      { status: 409 },
    );
  }
  if (!auth.scope.includes("drive")) {
    return NextResponse.json(
      { error: "Akun Google perlu di-authorize ulang dengan izin Drive — buka /api/auth/google sekali lagi." },
      { status: 409 },
    );
  }

  // Pairing → student name (legal name preferred) + documents.
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, menteeId, startDate")
    .eq("id", id)
    .single();
  if (!pairing) return NextResponse.json({ error: "Pairing tidak ditemukan" }, { status: 404 });

  const [{ data: mentee }, { data: profile }, { data: documents }] = await Promise.all([
    supabase.from("User").select("name").eq("id", pairing.menteeId).single(),
    supabase.from("MenteeProfile").select("fullLegalName").eq("userId", pairing.menteeId).single(),
    supabase.from("Document").select("name, fileName, filePath, mimeType, version, status")
      .eq("pairingId", id).order("createdAt", { ascending: true }),
  ]);

  const allDocs = documents || [];
  // Only mentor-APPROVED documents go to the agency archive — approval is
  // the quality gate before anything leaves the platform.
  const docs = allDocs.filter((d) => d.status === "approved");
  if (allDocs.length === 0) {
    return NextResponse.json({ error: "Belum ada dokumen untuk disync." }, { status: 400 });
  }
  if (docs.length === 0) {
    return NextResponse.json(
      { error: "Belum ada dokumen yang disetujui mentor. Minta mentor approve dulu (atau approve lewat Review) — hanya dokumen berstatus Disetujui yang disync ke Drive." },
      { status: 400 },
    );
  }
  const studentName = sanitize(profile?.fullLegalName || mentee?.name || "Tanpa Nama");

  try {
    const drive = makeDriveClient(auth.refreshToken);
    // Students Admission / {tahun intake} / {nama siswa}. The year comes from
    // the pairing start date (stable per student across re-syncs), falling
    // back to today for pairings without one.
    const started = pairing.startDate ? new Date(pairing.startDate) : new Date();
    const year = String(isNaN(started.getTime()) ? new Date().getFullYear() : started.getFullYear());
    const rootId = await ensureRootFolder(drive);
    const yearId = await ensureFolder(drive, year, rootId);
    const folderId = await ensureFolder(drive, studentName, yearId);

    let uploaded = 0, skipped = 0;
    const failed: string[] = [];
    for (const d of docs) {
      try {
        const ext = (d.fileName || d.filePath).split(".").pop() || "bin";
        const target = `${sanitize(d.name)} - v${d.version}.${ext}`;
        const res = await fetch(d.filePath);
        if (!res.ok) { failed.push(d.name); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const outcome = await uploadIfMissing(
          drive, folderId, target, d.mimeType || "application/octet-stream", buf,
        );
        if (outcome === "uploaded") uploaded++; else skipped++;
      } catch (e) {
        console.error(`[drive-sync] failed for "${d.name}":`, e);
        failed.push(d.name);
      }
    }

    return NextResponse.json({
      uploaded,
      skipped,
      failed,
      folderName: `${year}/${studentName}`,
      folderUrl: folderWebUrl(folderId),
    });
  } catch (e) {
    console.error("[drive-sync] error:", e);
    const msg = e instanceof Error ? e.message : "";
    // Most common operational failures, translated to actionable messages.
    if (/insufficient|scope|forbidden|403/i.test(msg)) {
      return NextResponse.json(
        { error: "Google menolak akses Drive — authorize ulang di /api/auth/google (izin Drive baru)." },
        { status: 409 },
      );
    }
    if (/has not been used|is disabled|accessNotConfigured/i.test(msg)) {
      return NextResponse.json(
        { error: "Google Drive API belum diaktifkan di Google Cloud Console untuk project OAuth SatuTuju." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Gagal sync ke Drive. Coba lagi." }, { status: 500 });
  }
}
