import { NextRequest, NextResponse } from "next/server";
import { supabase, DEPOSIT_PROOF_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/mentee-deposit/proof            → mentee views own proof image
 * GET /api/mentee-deposit/proof?userId=…   → admin views any mentee's proof
 *
 * Streams the bukti transfer from Supabase storage. Proof images are
 * financial data — never exposed via public URLs; mentees are restricted
 * to their own record by ignoring any `userId` param they pass.
 */

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = req.nextUrl.searchParams.get("userId");
  const targetUserId = user.role === "admin" && requested ? requested : user.userId;

  const { data: row, error: rowErr } = await supabase
    .from("MenteeDeposit")
    .select("proofPath")
    .eq("userId", targetUserId)
    .maybeSingle();
  if (rowErr) {
    console.error("Mentee deposit lookup error:", rowErr);
    return NextResponse.json({ error: "Gagal membaca data deposit" }, { status: 500 });
  }
  if (!row?.proofPath) {
    return NextResponse.json({ error: "Bukti transfer belum diunggah" }, { status: 404 });
  }

  const { data: file, error: fileErr } = await supabase.storage
    .from(DEPOSIT_PROOF_BUCKET)
    .download(row.proofPath);
  if (fileErr || !file) {
    console.error("Mentee deposit proof download error:", fileErr);
    return NextResponse.json({ error: "File bukti tidak ditemukan" }, { status: 404 });
  }

  const ext = row.proofPath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  const arrayBuffer = await file.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="bukti-deposit.${ext || "img"}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
