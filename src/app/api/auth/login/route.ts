/** Login route — v5 hardened.
 *
 *  Flow:
 *    1. Rate-limit check (per email + per IP via LoginAttempt).
 *    2. Constant-response credential check (never reveals which field failed).
 *    3. If user has 2FA enabled, require `code` in the body (clients send a
 *       second-step submission with the same email + code).
 *    4. Issue JWT cookie + return user shell.
 *
 *  Response codes:
 *    200  → logged in (body has `user`)
 *    202  → first step OK, second-factor required (body has `needs2FA: true`)
 *    401  → invalid credentials (anti-enumeration)
 *    429  → rate-limited; body has `retryAfterMs` + `requireCaptcha` flag
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createToken } from "@/lib/auth";
import { checkLimit, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyTotpLogin } from "@/lib/totp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const totpCode = body.code ? String(body.code).trim() : null;
    const turnstileToken = body.turnstileToken ?? null;
    const ip = getClientIp(req);

    if (!email || !password) {
      return NextResponse.json({ error: "Email atau kunci salah" }, { status: 401 });
    }

    // 1. Rate-limit gate.
    const limit = await checkLimit({ email, ip });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Terlalu banyak percobaan. Coba lagi sebentar lagi.",
          retryAfterMs: limit.retryAfterMs,
          requireCaptcha: limit.requireCaptcha,
        },
        { status: 429 },
      );
    }
    if (limit.requireCaptcha) {
      const ok = await verifyTurnstile({ token: turnstileToken, ip });
      if (!ok) {
        return NextResponse.json(
          { error: "Verifikasi keamanan gagal. Selesaikan CAPTCHA dan coba lagi.", requireCaptcha: true },
          { status: 429 },
        );
      }
    }

    // 2. Credential check (constant-response on any failure).
    const { data: user } = await supabase
      .from("User")
      .select("id, email, name, role, password, twoFactorEnabled, isActivated")
      .eq("email", email)
      .maybeSingle();

    const passwordOk = user?.password ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordOk) {
      await recordAttempt({ email, ip, success: false });
      return NextResponse.json({ error: "Email atau kunci salah" }, { status: 401 });
    }

    if (!user.isActivated) {
      await recordAttempt({ email, ip, success: false });
      return NextResponse.json(
        { error: "Akun belum diaktifkan. Cek email untuk tautan aktivasi." },
        { status: 403 },
      );
    }

    // 3. Optional 2FA step.
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        // First step succeeded — ask client to submit again with `code`.
        return NextResponse.json({ needs2FA: true }, { status: 202 });
      }
      const codeOk = await verifyTotpLogin({ userId: user.id, code: totpCode });
      if (!codeOk) {
        await recordAttempt({ email, ip, success: false });
        return NextResponse.json({ error: "Kode otentikator salah" }, { status: 401 });
      }
    }

    // 4. Success.
    await recordAttempt({ email, ip, success: true });
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Login error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
