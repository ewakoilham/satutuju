import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return 200 — never reveal whether the email exists
  const { data: user } = await supabase
    .from("User")
    .select("id, email, name")
    .ilike("email", email.trim())
    .single();

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabase
      .from("User")
      .update({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .eq("id", user.id);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.satutuju.id").replace(/\/+$/, "");
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "Satu Tuju <noreply@satutuju.id>",
      to: user.email,
      subject: "Reset your Satu Tuju password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #1e3a5f; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #555; margin-bottom: 24px;">Hi ${user.name},</p>
          <p style="color: #555; margin-bottom: 24px;">
            We received a request to reset your Satu Tuju password.
            Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetLink}"
            style="display: inline-block; background: #1e3a5f; color: #fff; text-decoration: none;
                   padding: 12px 28px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
            Reset Password
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
          <p style="color: #bbb; font-size: 12px; margin-top: 8px;">
            Or copy this link: ${resetLink}
          </p>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
