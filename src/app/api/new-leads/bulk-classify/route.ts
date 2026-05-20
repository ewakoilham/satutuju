import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { classifyLead } from "@/lib/leads/bucketing";
import { newStageHistoryId } from "@/lib/leads/ids";
import { MENTORS } from "@/lib/mentors";

const MAX_BULK = 200;

/**
 * Bulk re-classify — re-runs classifyLead() over selected leads using
 * the CURRENT mentor list + CAMPUS_ALIASES. Useful after:
 *   - The static mentor list was updated (new country covered)
 *   - CAMPUS_ALIASES was edited (typo fix, new alias added)
 *   - The bucketing logic itself was tweaked
 *
 * Only writes when the new classification differs — keeps the
 * bucketReason fresh + LeadStageHistory clean of no-op rows.
 *
 * Body: { leadIds: string[] }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { leadIds?: unknown };
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
  const leadIds = body.leadIds.filter((x): x is string => typeof x === "string");

  const { data: leads, error: loadErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .in("id", leadIds);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const results: Array<{ leadId: string; prevBucket: string; newBucket: string; changed: boolean }> = [];
  const mentorCountries = MENTORS.map((m) => ({ country: m.country ?? null }));
  const now = new Date().toISOString();

  let changed = 0;
  for (const lead of (leads ?? []) as unknown as Array<{
    id: string; bucket: string; stage: string; targetCampusAndProgram: string;
  }>) {
    const result = classifyLead(lead.targetCampusAndProgram, mentorCountries);
    const didChange = result.bucket !== lead.bucket;

    await supabase
      .from("Lead")
      .update({
        bucket: result.bucket,
        bucketReason: result.reason,
        parsedCountry: result.parsedCountry,
        parsedCampus: result.parsedCampus,
        parsedField: result.parsedField,
        isCampusPartner: result.isCampusPartner,
        hasCountryMentor: result.hasCountryMentor,
        updatedAt: now,
      })
      .eq("id", lead.id);

    if (didChange) {
      changed++;
      await supabase.from("LeadStageHistory").insert({
        id: newStageHistoryId(),
        leadId: lead.id,
        fromStage: lead.stage,
        toStage: lead.stage,
        changedBy: user.userId,
        note: `Re-classified (bulk): ${lead.bucket} → ${result.bucket}. ${result.reason}`,
        createdAt: now,
      });
    }
    results.push({ leadId: lead.id, prevBucket: lead.bucket, newBucket: result.bucket, changed: didChange });
  }

  return NextResponse.json({
    total: leadIds.length,
    changed,
    unchanged: leadIds.length - changed,
    results,
  });
}
