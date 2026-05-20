import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_STEP_DEFINITION_COLUMNS } from "@/lib/db-columns";
import { seedStepStatusForExistingLeadsOnNewStep } from "@/lib/leads/step-helpers";
import { STEP_AUTO_TRIGGERS } from "@/lib/leads/types";

function generateId(): string {
  return "stp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

function sanitizeAutoTrigger(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return null;
  return (STEP_AUTO_TRIGGERS as readonly string[]).includes(v) ? v : null;
}

/** GET — list all step definitions (including inactive for admin UI). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { data, error } = await supabase
    .from("LeadStepDefinition")
    .select(LEAD_STEP_DEFINITION_COLUMNS)
    .order("order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ steps: data ?? [] });
}

/** POST — create a new step definition. Auto-appends at end. Retro-seeds
 *  LeadStepStatus(pending) rows for every existing Lead. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { label?: unknown; description?: unknown; autoTrigger?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const autoTrigger = sanitizeAutoTrigger(body.autoTrigger);

  // Find current max order to append at end.
  const { data: maxRow } = await supabase
    .from("LeadStepDefinition")
    .select("order")
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.order ?? 0) + 1;

  const id = generateId();
  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("LeadStepDefinition")
    .insert({
      id,
      order: nextOrder,
      label: label.slice(0, 200),
      description: description ? description.slice(0, 500) : null,
      autoTrigger,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .select(LEAD_STEP_DEFINITION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Retro-fill: every existing Lead gets a pending status for this new step.
  const seedResult = await seedStepStatusForExistingLeadsOnNewStep(id);

  return NextResponse.json({
    step: created,
    retroSeeded: seedResult.inserted,
    warning: seedResult.ok ? undefined : seedResult.error,
  }, { status: 201 });
}
