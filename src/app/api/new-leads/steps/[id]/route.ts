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

/**
 * Count non-pending LeadStepStatus rows for a step. Used as defense-in-
 * depth gate against:
 *   • DELETE that would lose audit history
 *   • PATCH that changes autoTrigger on a step with live history
 *     (would create rows whose "completed by trigger X" no longer
 *      matches the step's current trigger — silent data drift).
 */
async function countStatusHistory(stepId: string): Promise<{ done: number; skipped: number; total: number }> {
  const { count: doneCount } = await supabase
    .from("LeadStepStatus")
    .select("*", { count: "exact", head: true })
    .eq("stepId", stepId)
    .eq("status", "done");
  const { count: skippedCount } = await supabase
    .from("LeadStepStatus")
    .select("*", { count: "exact", head: true })
    .eq("stepId", stepId)
    .eq("status", "skipped");
  const done = doneCount ?? 0;
  const skipped = skippedCount ?? 0;
  return { done, skipped, total: done + skipped };
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

  // Gate autoTrigger mutation: if the step already has done/skipped
  // history, switching trigger would mean those rows say "completed by
  // trigger X" while the step now lists trigger Y. Force admin to
  // create a fresh step instead.
  if ("autoTrigger" in body) {
    const nextTrigger = sanitizeAutoTrigger(body.autoTrigger);
    const { data: cur } = await supabase
      .from("LeadStepDefinition")
      .select("autoTrigger")
      .eq("id", id)
      .single();
    const curTrigger = (cur?.autoTrigger ?? null) as string | null;
    if (curTrigger !== nextTrigger) {
      const history = await countStatusHistory(id);
      if (history.total > 0) {
        return NextResponse.json(
          {
            error: `Tidak bisa ubah trigger: step ini punya ${history.total} riwayat status (${history.done} done · ${history.skipped} skipped). Buat step baru saja.`,
            doneCount: history.done,
            skippedCount: history.skipped,
          },
          { status: 409 },
        );
      }
    }
    update.autoTrigger = nextTrigger;
  }
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

/**
 * DELETE — hard delete with safeguard.
 *
 * If LeadStepStatus rows exist with status != pending (i.e. real audit
 * history), refuse with 409 unless caller passes ?force=true. The UI
 * presents "Nonaktifkan saja" as the primary CTA so admin keeps history;
 * `force=true` is the typed-confirmation escape hatch.
 *
 * Cascades to LeadStepStatus via FK once approved.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const probe = req.nextUrl.searchParams.get("probe") === "true";

  // Probe mode: return counts without deleting. UI uses this to drive
  // the delete-step modal (history? show preserve/destroy options. no
  // history? show plain confirm.).
  if (probe) {
    const history = await countStatusHistory(id);
    return NextResponse.json({
      doneCount: history.done,
      skippedCount: history.skipped,
      totalAffectedLeads: history.total,
    });
  }

  if (!force) {
    const history = await countStatusHistory(id);
    if (history.total > 0) {
      return NextResponse.json(
        {
          error: `Step ini punya ${history.total} riwayat status di leads (${history.done} done · ${history.skipped} skipped). Nonaktifkan saja untuk preserve history, atau retry dengan ?force=true untuk hapus permanen.`,
          doneCount: history.done,
          skippedCount: history.skipped,
          totalAffectedLeads: history.total,
          deactivateInstead: true,
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("LeadStepDefinition")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
