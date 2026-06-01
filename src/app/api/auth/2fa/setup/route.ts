/** GET /api/auth/2fa/setup
 *
 *  Logged-in user requests TOTP enrollment. Returns the otpauth URL
 *  (paste-in fallback) and a base64-encoded QR data URL that the UI
 *  renders for the Authenticator app scan. The actual secret is stored
 *  server-side (encrypted) — never returned to the client.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setupTotp } from "@/lib/totp";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { otpauthUrl, qrDataUrl } = await setupTotp({ userId: user.userId, email: user.email });
  return NextResponse.json({ otpauthUrl, qrDataUrl });
}
