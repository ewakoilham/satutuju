/** POST /api/sessions/[id]/aigen — Phase D.2 of the v5 redesign.
 *
 *  Generates a draft session report by passing user-supplied notes through
 *  Gemini. Three input modes:
 *
 *    { text: "..." }                   — pasted prose (manual paste)
 *    { driveUrl: "https://docs..." }   — public Drive doc; we fetch the
 *                                        "export?format=txt" variant
 *    { fileName, fileText: "..." }     — uploaded file, parsed client-side
 *                                        (PDF/DOCX text extraction is too
 *                                        heavy for the API runtime)
 *
 *  Returns the structured draft (topic/summary/obstacles/mentorNotes/mood)
 *  so the client can prefill the laporan form. The draft is NOT persisted
 *  here — the user reviews & edits, then their own typing triggers the
 *  existing auto-save.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { summarizeSession, isGeminiConfigured } from "@/lib/gemini";

const MAX_TEXT_CHARS = 50_000; // ~12k tokens — well within Gemini Flash's window
const ALLOWED_DRIVE_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
]);

interface RequestBody {
  text?: string;
  driveUrl?: string;
  fileName?: string;
  fileText?: string;
}

/** Convert a Drive sharing URL into the txt export URL. We rely on the doc
 *  being shared as "anyone with the link can view" — we don't have the user's
 *  OAuth token here (Drive OAuth is deferred per the v5 spec dissent). */
function deriveDriveExportUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!ALLOWED_DRIVE_HOSTS.has(u.hostname)) return null;

    // Docs: https://docs.google.com/document/d/<id>/edit?... → export?format=txt
    const docsMatch = u.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) {
      return `https://docs.google.com/document/d/${docsMatch[1]}/export?format=txt`;
    }

    // Drive file: https://drive.google.com/file/d/<id>/view → uc?export=download
    const driveMatch = u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchDriveText(url: string): Promise<string> {
  const exportUrl = deriveDriveExportUrl(url);
  if (!exportUrl) {
    throw new Error("URL Drive tidak dikenali. Pastikan link Doc / Drive yang valid.");
  }
  const res = await fetch(exportUrl, {
    redirect: "follow",
    // Drive sometimes redirects through an interstitial — we accept HTML and
    // strip later if needed.
    headers: { "user-agent": "Mozilla/5.0 SatuTuju-Aigen" },
  });
  if (!res.ok) {
    throw new Error(
      `Tidak bisa membaca Drive (${res.status}). Pastikan dokumen di-set "Anyone with the link can view".`,
    );
  }
  const text = await res.text();
  // If Drive returned an HTML interstitial (large files), bail with a clear msg.
  if (text.includes("<html") && text.includes("download_warning")) {
    throw new Error("Dokumen Drive terlalu besar untuk auto-export. Coba paste isinya langsung.");
  }
  return text;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini belum dikonfigurasi. Tambahkan GEMINI_API_KEY ke .env." },
      { status: 503 },
    );
  }

  // Access check: caller must be mentor on the pairing (or admin).
  const { data: session } = await supabase
    .from("Session")
    .select("id, sessionNum, phase, pairingId")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId, mentee:User!menteeId(name)")
    .eq("id", session.pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing tidak ditemukan." }, { status: 404 });

  if (user.role !== "admin" && pairing.mentorId !== user.userId) {
    return NextResponse.json({ error: "Hanya mentor sesi ini yang bisa pakai AI assist." }, { status: 403 });
  }

  const body = (await req.json()) as RequestBody;

  let text = "";
  if (body.fileText && body.fileText.trim()) {
    text = body.fileText.trim();
  } else if (body.text && body.text.trim()) {
    text = body.text.trim();
  } else if (body.driveUrl && body.driveUrl.trim()) {
    try {
      text = await fetchDriveText(body.driveUrl.trim());
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Gagal membaca Drive." },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "Kirim minimal salah satu: text, driveUrl, atau fileText." },
      { status: 400 },
    );
  }

  if (text.length < 50) {
    return NextResponse.json(
      { error: "Catatan terlalu pendek untuk diringkas (minimal ~50 karakter)." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
  }

  const menteeName = (pairing.mentee as unknown as { name?: string } | null)?.name;

  try {
    const draft = await summarizeSession({
      text,
      phase: session.phase,
      sessionNum: session.sessionNum,
      menteeName,
    });
    return NextResponse.json({ draft, charsUsed: text.length, source: body.driveUrl ? "drive" : body.fileText ? "file" : "text" });
  } catch (err) {
    console.error("[aigen] gemini failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghubungi Gemini." },
      { status: 502 },
    );
  }
}
