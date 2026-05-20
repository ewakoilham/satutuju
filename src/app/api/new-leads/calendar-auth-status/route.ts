import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadAuth } from "@/lib/integrations/google-calendar";

/**
 * Lightweight status check for the admin UI — drives the "Connect
 * Google Calendar" button vs the "Sync from Calendar" button.
 * Returns minimal info; never exposes the refresh token.
 */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const auth = await loadAuth();
  if (!auth) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    googleEmail: auth.googleEmail,
    connectedAt: auth.connectedAt,
    lastSyncAt: auth.lastSyncAt,
  });
}
