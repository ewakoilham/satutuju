import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_STEP_DEFINITION_COLUMNS } from "@/lib/db-columns";
import { STEP_AUTO_TRIGGERS } from "@/lib/leads/types";

function sanitizeAutoTrigger(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return null;
  return (STEP_AUTO_TRIGGERS as readonly string[]).includes(v) ? v : null;
}

/** PATCH — update label / description / autoTrigger / isActive. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") update.label = body.label.trim().slice(0, 200);
  if (typeof body.description === "string") update.description = body.description.trim().slice(0, 500);
  if (body.description === null) update.description = null;
  if ("autoTrigger" in body) update.autoTrigger = sanitizeAutoTrigger(body.autoTrigger);
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }
  update.updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("LeadStepDefinition")
    .update(update)
    .eq("id", id)
    .select(LEAD_STEP_DEFINITION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ step: data });
}

/** DELETE — hard delete. Cascades to LeadStepStatus via FK. Prefer
 *  deactivating instead unless the step was created in error. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabase
    .from("LeadStepDefinition")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
