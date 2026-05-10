import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import type { IdentitySnapshot } from "@/lib/contract-template";
import { renderAndUploadContractPdf } from "@/lib/contract-pdf-storage";

export const runtime = "nodejs";

/**
 * POST /api/mentor-contract/regenerate-pdf
 * POST /api/mentor-contract/regenerate-pdf?userId=… (admin only)
 *
 * Re-renders the PDF for an already-SIGNED contract using its frozen
 * `identitySnapshot` and `signatureDataUrl`. The audit trail (hash, IP,
 * signedAt) is untouched — only the PDF in storage is replaced and
 * `updatedAt` is bumped.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "mentor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requested = req.nextUrl.searchParams.get("userId");
  const targetUserId =
    user.role === "admin" && requested ? requested : user.userId;

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

  const { pdfPath, error: pdfError } = await renderAndUploadContractPdf({
    userId: targetUserId,
    identity: row.identitySnapshot as IdentitySnapshot,
    signatureDataUrl: row.signatureDataUrl,
    contractNumber: row.contractNumber,
    signedAt: new Date(row.signedAt),
  });
  if (pdfError || !pdfPath) {
    console.error("Regenerate PDF failed:", pdfError);
    return NextResponse.json(
      { error: pdfError ?? "Gagal merender PDF" },
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
}
