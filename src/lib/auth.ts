import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Fail closed: never fall back to a hardcoded key. A missing JWT_SECRET
// must crash, not silently sign tokens with a secret anyone reading the
// source could use to forge admin sessions.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error("JWT_SECRET environment variable is required");
}
const secret = new TextEncoder().encode(rawSecret);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
