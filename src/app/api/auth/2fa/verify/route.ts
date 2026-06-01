/** POST /api/auth/2fa/verify  → enrollment verification.
 *
 *  Body: { code: string }
 *  Returns { ok: true } and flips User.twoFactorEnabled when the submitted
 *  code matches the pending (unverified) TOTP secret. From this point on
 *  the login route requires a code on every sign-in for this user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyTotpEnrollment } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Kode harus 6 digit." }, { status: 400 });
  }
  const ok = await verifyTotpEnrollment({ userId: user.userId, code });
  if (!ok) {
    return NextResponse.json({ error: "Kode salah. Coba lagi." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
