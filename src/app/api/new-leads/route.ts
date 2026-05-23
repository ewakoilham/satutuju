import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_BUCKETS, FUNDING_PLANS, type Lead, type FundingPlan } from "@/lib/leads/types";
import { classifyLead } from "@/lib/leads/bucketing";
import { MENTORS } from "@/lib/mentors";
import { completeStepByTrigger, seedStepStatusesForLead } from "@/lib/leads/step-helpers";
import { newLeadId, newStageHistoryId } from "@/lib/leads/ids";

/**
 * Admin-only list endpoint. Supports filtering + server-paginated range.
 *
 * Query params (all optional, repeatable for arrays):
 *   bucket=A&bucket=B            multi-select bucket filter
 *   stage=new&stage=outreach_sent
 *   country=Australia
 *   funding=scholarship
 *   interviewer=Razak | Venzo | Unassigned
 *   engagement=opened|clicked|not_opened
 *   q=search-text                matches name OR email (ILIKE)
 *   from=YYYY-MM-DD&to=YYYY-MM-DD  submitted-at range
 *   limit=50&offset=0             pagination
 *   sort=submittedAt&dir=desc     sort field + direction
 *
 * Response: { leads: Lead[], total: number, progress: Record<leadId, {done, total}> }
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const buckets       = searchParams.getAll("bucket");
  const stages        = searchParams.getAll("stage");
  const countries     = searchParams.getAll("country");
  const fundings      = searchParams.getAll("funding");
  const interviewer   = searchParams.get("interviewer");
  const engagement    = searchParams.get("engagement");
  const q             = (searchParams.get("q") || "").trim();
  const from          = searchParams.get("from");
  const to            = searchParams.get("to");
  const limit         = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset        = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const sort          = searchParams.get("sort") || "submittedAt";
  const dir           = (searchParams.get("dir") || "desc") === "asc" ? "asc" : "desc";

  // Whitelist sortable columns so query param can't inject random SQL.
  const SORTABLE = new Set([
    "submittedAt", "createdAt", "updatedAt", "name", "email",
    "bucket", "stage", "parsedCountry",
  ]);
  const sortKey = SORTABLE.has(sort) ? sort : "submittedAt";

  // Build the paginated list query.
  let query = supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS, { count: "exact" });

  if (buckets.length > 0) query = query.in("bucket", buckets);
  if (stages.length > 0) query = query.in("stage", stages);
  if (countries.length > 0) query = query.in("parsedCountry", countries);
  if (fundings.length > 0) query = query.in("fundingPlan", fundings);

  if (interviewer === "Unassigned") {
    query = query.is("assignedInterviewer", null);
  } else if (interviewer === "Razak" || interviewer === "Venzo") {
    query = query.eq("assignedInterviewer", interviewer);
  }

  if (engagement === "opened") query = query.not("emailOpenedAt", "is", null);
  else if (engagement === "clicked") query = query.not("emailClickedAt", "is", null);
  else if (engagement === "not_opened") query = query.is("emailOpenedAt", null);

  if (from) query = query.gte("submittedAt", new Date(from).toISOString());
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    query = query.lte("submittedAt", toEnd.toISOString());
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`);
  }

  // Bucket-count aggregate query — same filters minus range/sort. Cheap:
  // each row is a short string; 200 rows = ~2 KB.
  let bucketsQuery = supabase.from("Lead").select("bucket");
  if (buckets.length > 0) bucketsQuery = bucketsQuery.in("bucket", buckets);
  if (stages.length > 0) bucketsQuery = bucketsQuery.in("stage", stages);
  if (countries.length > 0) bucketsQuery = bucketsQuery.in("parsedCountry", countries);
  if (fundings.length > 0) bucketsQuery = bucketsQuery.in("fundingPlan", fundings);
  if (interviewer === "Unassigned") bucketsQuery = bucketsQuery.is("assignedInterviewer", null);
  else if (interviewer === "Razak" || interviewer === "Venzo") bucketsQuery = bucketsQuery.eq("assignedInterviewer", interviewer);
  if (engagement === "opened") bucketsQuery = bucketsQuery.not("emailOpenedAt", "is", null);
  else if (engagement === "clicked") bucketsQuery = bucketsQuery.not("emailClickedAt", "is", null);
  else if (engagement === "not_opened") bucketsQuery = bucketsQuery.is("emailOpenedAt", null);
  if (from) bucketsQuery = bucketsQuery.gte("submittedAt", new Date(from).toISOString());
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    bucketsQuery = bucketsQuery.lte("submittedAt", toEnd.toISOString());
  }
  if (q) {
    bucketsQuery = bucketsQuery.or(`name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`);
  }

  const [listRes, bucketsRes] = await Promise.all([
    query
      .order(sortKey, { ascending: dir === "asc" })
      .range(offset, offset + limit - 1),
    bucketsQuery,
  ]);

  const { data: leads, count, error } = listRes;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Initialize counts from LEAD_BUCKETS so newly-added enum values
  // (e.g. "incomplete", "domestic") are automatically counted without
  // needing to touch this route. Unknown values still skip silently.
  const bucketCounts: Record<string, number> = Object.fromEntries(
    LEAD_BUCKETS.map((b) => [b, 0]),
  );
  for (const row of (bucketsRes.data ?? []) as Array<{ bucket: string }>) {
    if (row.bucket in bucketCounts) bucketCounts[row.bucket]++;
  }

  // Compute per-lead progress (X done / Y total active steps).
  const leadRows = (leads ?? []) as unknown as Lead[];
  const leadIds = leadRows.map((l) => l.id);
  const { count: totalActiveSteps } = await supabase
    .from("LeadStepDefinition")
    .select("id", { count: "exact", head: true })
    .eq("isActive", true);

  let progress: Record<string, { done: number; total: number }> = {};
  if (leadIds.length > 0 && (totalActiveSteps ?? 0) > 0) {
    const { data: statusRows } = await supabase
      .from("LeadStepStatus")
      .select("leadId, status")
      .in("leadId", leadIds);
    progress = leadIds.reduce<Record<string, { done: number; total: number }>>((acc, id) => {
      acc[id] = { done: 0, total: totalActiveSteps ?? 0 };
      return acc;
    }, {});
    for (const row of statusRows ?? []) {
      const r = row as { leadId: string; status: string };
      if (r.status === "done" && progress[r.leadId]) progress[r.leadId].done += 1;
    }
  }

  // Phase 13: surface mentor-note counts per lead so inbox rows can
  // show a chat-icon indicator. One bulk query keyed on leadIds.
  const mentorNoteCount: Record<string, number> = {};
  if (leadIds.length > 0) {
    const { data: noteRows } = await supabase
      .from("LeadNote")
      .select('"leadId"')
      .is("parentNoteId", null)
      .in("leadId", leadIds);
    for (const n of noteRows ?? []) {
      const lid = n.leadId as string;
      mentorNoteCount[lid] = (mentorNoteCount[lid] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    leads: leads ?? [],
    total: count ?? 0,
    progress,
    bucketCounts,
    mentorNoteCount,
  });
}

/**
 * Manual lead entry — admin creates a lead via UI (the lead bypassed
 * Tally, mis. mentor referral, organic inquiry via DM). Runs the same
 * classifyLead() pipeline as the Tally sync so bucket + parsedCountry +
 * parsedField are populated automatically.
 *
 * Body: { name, email, whatsappNumber?, targetCampusAndProgram, fundingPlan }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: {
    name?: unknown;
    email?: unknown;
    whatsappNumber?: unknown;
    targetCampusAndProgram?: unknown;
    fundingPlan?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const target = typeof body.targetCampusAndProgram === "string" ? body.targetCampusAndProgram.trim() : "";
  const whatsapp = typeof body.whatsappNumber === "string" ? body.whatsappNumber.trim() || null : null;
  const fundingPlan = typeof body.fundingPlan === "string" ? body.fundingPlan : "";

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "valid email required" }, { status: 400 });
  if (!(FUNDING_PLANS as readonly string[]).includes(fundingPlan)) {
    return NextResponse.json(
      { error: `fundingPlan must be one of: ${FUNDING_PLANS.join("|")}` },
      { status: 400 },
    );
  }

  // Run classifier so the manual entry lands with the right bucket from
  // the get-go (admin can still override afterwards via inline row).
  const cls = classifyLead(target, MENTORS.map((m) => ({ country: m.country ?? null })));

  const id = newLeadId();
  const now = new Date().toISOString();

  const { data: lead, error: insErr } = await supabase
    .from("Lead")
    .insert({
      id,
      name,
      email,
      whatsappNumber: whatsapp,
      targetCampusAndProgram: target || "(target tidak diisi)",
      fundingPlan: fundingPlan as FundingPlan,
      submittedAt: now,
      tallySubmissionId: null,  // null distinguishes manual from Tally-sourced
      bucket: cls.bucket,
      bucketReason: cls.reason,
      parsedCountry: cls.parsedCountry,
      parsedCampus: cls.parsedCampus,
      parsedField: cls.parsedField,
      isCampusPartner: cls.isCampusPartner,
      hasCountryMentor: cls.hasCountryMentor,
      partnerProgramScope: cls.partnerProgramScope,
      stage: "new",
      createdAt: now,
      updatedAt: now,
    })
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Seed pipeline step statuses + write creation history
  await seedStepStatusesForLead(id);
  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: null,
    toStage: "new",
    changedBy: user.userId,
    note: `Manual entry by ${user.name ?? user.userId}. ${cls.reason}`,
    createdAt: now,
  });
  // Auto-complete the "Klasifikasi otomatis" pipeline step.
  await completeStepByTrigger(id, "classified").catch(() => {});

  return NextResponse.json({ lead, classification: cls });
}
