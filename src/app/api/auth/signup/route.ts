import { NextResponse } from "next/server";

// Public signup is permanently disabled — Satu Tuju is invite-only.
// Accounts are created by an admin (/api/users) or via an admin email
// invite that the user activates at /api/auth/activate. This endpoint is
// kept as a hard 403 so any old client or scripted POST cannot create users.
export async function POST() {
  return NextResponse.json(
    { error: "Pendaftaran hanya melalui undangan admin." },
    { status: 403 },
  );
}
