import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { safeContractNumber } from "@/lib/contract-numbering";

export const runtime = "nodejs";

/**
 * GET /api/mentee-contract/pdf            → mentee downloads own PDF
 * GET /api/mentee-contract/pdf?userId=…   → admin downloads any mentee's PDF
 *
 * Streams the PDF from Supabase storage. Mentees are restricted to their
 * own record by ignoring any `userId` param they pass.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = req.nextUrl.searchParams.get("userId");
  const targetUserId =
    user.role === "admin" && requested ? requested : user.userId;

  const { data: row, error: rowErr } = await supabase
    .from("MenteeContract")
    .select("contractNumber,pdfPath,status")
    .eq("userId", targetUserId)
    .maybeSingle();
  if (rowErr) {
    console.error("Mentee contract lookup error:", rowErr);
    return NextResponse.json({ error: "Gagal membaca kontrak" }, { status: 500 });
  }
  if (!row || !row.pdfPath || row.status !== "SIGNED") {
    return NextResponse.json({ error: "Kontrak belum ditandatangani" }, { status: 404 });
  }

  const { data: file, error: fileErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(row.pdfPath);
  if (fileErr || !file) {
    console.error("Mentee contract PDF download error:", fileErr);
    return NextResponse.json({ error: "PDF tidak ditemukan" }, { status: 404 });
  }

  const arrayBuffer = await file.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Perjanjian_Layanan_Mentoring_Mentee_${safeContractNumber(row.contractNumber)}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
