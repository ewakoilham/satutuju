import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * POST — bulk update of step display orders.
 *
 * Body: { orderedIds: string[] }
 * Assigns order = index + 1 to each id in the given order.
 *
 * Implemented as sequential per-row updates since Supabase's PostgREST
 * doesn't expose a single-statement bulk update with different values per
 * row. Step count is small (<20), so this is fine.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { orderedIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = body.orderedIds;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "orderedIds must be a string[]" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const errors: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] as string;
    const { error } = await supabase
      .from("LeadStepDefinition")
      .update({ order: i + 1, updatedAt: now })
      .eq("id", id);
    if (error) errors.push(`${id}: ${error.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Partial reorder failure", details: errors }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: ids.length });
}
