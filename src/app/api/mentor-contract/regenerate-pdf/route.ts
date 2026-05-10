import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  getContractBody,
  interpolateContract,
  type IdentitySnapshot,
} from "@/lib/contract-template";
import { renderContractPdf } from "@/lib/contract-pdf";

export const runtime = "nodejs";

/**
 * POST /api/mentor-contract/regenerate-pdf
 * POST /api/mentor-contract/regenerate-pdf?userId=… (admin only)
 *
 * Re-renders the PDF for an already-SIGNED contract using its frozen
 * `identitySnapshot` and `signatureDataUrl`. Useful when the original
 * sign request hit a transient PDF rendering bug — the row's audit
 * trail (hash, IP, signedAt) stays unchanged. The new PDF is uploaded
 * to the same `pdfPath` (or generated if previously null) and the row
 * is updated in place.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = req.nextUrl.searchParams.get("userId");
  const targetUserId =
    user.role === "admin" && requested ? requested : user.userId;

  // Mentor can only regenerate own; admin can regenerate any.
  if (user.role !== "admin" && user.role !== "mentor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("MentorContract")
    .select("*")
    .eq("userId", targetUserId)
    .maybeSingle();
  if (rowErr) {
    console.error("Regenerate PDF: contract fetch error:", rowErr);
    return NextResponse.json({ error: "Gagal membaca kontrak" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Kontrak tidak ditemukan" }, { status: 404 });
  }
  if (row.status !== "SIGNED") {
    return NextResponse.json(
      { error: "Hanya kontrak yang sudah ditandatangani yang bisa di-regenerate" },
      { status: 400 },
    );
  }
  if (!row.signatureDataUrl || !row.identitySnapshot || !row.signedAt) {
    return NextResponse.json(
      { error: "Data tanda tangan tidak lengkap di record" },
      { status: 422 },
    );
  }

  try {
    const identity = row.identitySnapshot as IdentitySnapshot;
    const templateBody = await getContractBody();
    const interpolated = interpolateContract(templateBody, {
      identity,
      contractNumber: row.contractNumber,
      signedAt: new Date(row.signedAt),
    });
    const pdfBuffer = await renderContractPdf({
      interpolatedBody: interpolated,
      identity,
      signatureDataUrl: row.signatureDataUrl,
      contractNumber: row.contractNumber,
    });

    const safeNumber = row.contractNumber.replace(/\//g, "_");
    const pdfPath = row.pdfPath ?? `contracts/${targetUserId}/${safeNumber}.pdf`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upload.error) {
      console.error("Regenerate PDF upload error:", upload.error);
      return NextResponse.json(
        { error: `Gagal mengunggah PDF: ${upload.error.message}` },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("MentorContract")
      .update({ pdfPath, updatedAt: new Date().toISOString() })
      .eq("userId", targetUserId)
      .select()
      .single();
    if (error) {
      console.error("Regenerate PDF row update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ contract: data });
  } catch (e) {
    console.error("Regenerate PDF render error:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Internal error",
      },
      { status: 500 },
    );
  }
}
