import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const MAX_BULK = 200;

/**
 * Bulk assign an interviewer to selected leads. `interviewer` is a
 * free-form string (currently the spec mentions Razak / Venzo but we
 * don't validate — operator can put any name).
 *
 * Pass `interviewer: null` to clear the assignment.
 *
 * Body: { leadIds: string[]; interviewer: string | null }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { leadIds?: unknown; interviewer?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }
  if (body.leadIds.length > MAX_BULK) {
    return NextResponse.json({ error: `Max ${MAX_BULK} leads per request` }, { status: 400 });
  }
  // null = clear, string = set. Anything else = invalid.
  let interviewer: string | null;
  if (body.interviewer === null) {
    interviewer = null;
  } else if (typeof body.interviewer === "string" && body.interviewer.trim()) {
    interviewer = body.interviewer.trim().slice(0, 50);
  } else {
    return NextResponse.json({ error: "interviewer must be a non-empty string or null" }, { status: 400 });
  }

  const leadIds = body.leadIds.filter((x): x is string => typeof x === "string");
  const now = new Date().toISOString();

  const { error: updErr, count } = await supabase
    .from("Lead")
    .update({
      assignedInterviewer: interviewer,
      updatedAt: now,
    }, { count: "exact" })
    .in("id", leadIds);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    total: leadIds.length,
    updated: count ?? leadIds.length,
    interviewer,
  });
}
