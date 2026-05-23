import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { MENTOR_LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { requireMentor } from "@/lib/leads/auth-guards";

/**
 * GET /api/mentor/leads — paginated lead list for the mentor surface.
 *
 * Mentor-scoped view. Only the columns in MENTOR_LEAD_SELECT_COLUMNS
 * are returned — never stage/bucket/decision/callNotes/etc. Each lead
 * is decorated with `flaggedByMe` and `noteCount` for the inbox table.
 *
 * Query params:
 *   q          — search across name/email/targetCampusAndProgram
 *   flaggedOnly=1 — restrict to leads this mentor has flagged
 *   country    — Lead.parsedCountry filter. Special value "__none__"
 *                filters to leads where parsedCountry IS NULL.
 *   limit, offset — pagination, capped at 200
 *
 * Response also includes `countryCounts`: distinct parsedCountry → row
 * count of leads matching `q` + `flaggedOnly` (but NOT `country`) so
 * the UI dropdown can show "Australia (12)" without losing options
 * after the mentor picks one country.
 */

const NONE_KEY = "__none__";

export async function GET(req: NextRequest) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const flaggedOnly = sp.get("flaggedOnly") === "1";
  const countryParam = sp.get("country")?.trim() ?? "";
  const country = countryParam || null;
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;

  // If flaggedOnly, prefilter to the lead ids this mentor has tagged.
  let restrictIds: string[] | null = null;
  if (flaggedOnly) {
    const { data: flags, error: flagErr } = await supabase
      .from("MentorLeadFlag")
      .select('"leadId"')
      .eq("mentorId", mentor.userId);
    if (flagErr) return NextResponse.json({ error: flagErr.message }, { status: 500 });
    restrictIds = (flags ?? []).map((f) => f.leadId as string);
    if (restrictIds.length === 0) {
      return NextResponse.json({ leads: [], total: 0, countryCounts: {} });
    }
  }

  /** Apply the filters shared by the main query and the country-counts
   *  aggregation. `withCountry=true` adds the country narrow on top
   *  (used by the main paginated query). */
  function applyFilters<T extends { or: (...a: unknown[]) => T; in: (col: string, vals: unknown[]) => T; eq: (col: string, val: unknown) => T; is: (col: string, val: null) => T }>(
    qb: T,
    withCountry: boolean,
  ): T {
    if (q) {
      qb = qb.or(
        `name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`,
      ) as T;
    }
    if (restrictIds) qb = qb.in("id", restrictIds) as T;
    if (withCountry && country) {
      if (country === NONE_KEY) qb = qb.is("parsedCountry", null) as T;
      else qb = qb.eq("parsedCountry", country) as T;
    }
    return qb;
  }

  // Main paginated query — all filters applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("Lead")
    .select(MENTOR_LEAD_SELECT_COLUMNS, { count: "exact" })
    .order("submittedAt", { ascending: false, nullsFirst: false })
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);
  query = applyFilters(query, true);

  const { data: leadsRaw, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = (leadsRaw ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;

  // Aggregation query — same filters MINUS the country narrow, so the
  // dropdown options stay stable after a mentor picks a country.
  // Cheap: pulls only one column.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase.from("Lead").select('"parsedCountry"');
  countQuery = applyFilters(countQuery, false);
  const { data: countryRows } = await countQuery;
  const countryCounts: Record<string, number> = {};
  for (const r of (countryRows ?? []) as Array<{ parsedCountry: string | null }>) {
    const key = r.parsedCountry ?? NONE_KEY;
    countryCounts[key] = (countryCounts[key] ?? 0) + 1;
  }

  // Decorate with flaggedByMe + noteCount per lead.
  const leadIds = leads.map((l) => l.id);
  let flaggedSet = new Set<string>();
  const noteCountByLead = new Map<string, number>();
  if (leadIds.length > 0) {
    const [{ data: flags }, { data: notes }] = await Promise.all([
      supabase
        .from("MentorLeadFlag")
        .select('"leadId"')
        .eq("mentorId", mentor.userId)
        .in("leadId", leadIds),
      supabase
        .from("LeadNote")
        .select('"leadId"')
        .eq("authorId", mentor.userId)
        .is("parentNoteId", null)
        .in("leadId", leadIds),
    ]);
    flaggedSet = new Set((flags ?? []).map((f) => f.leadId as string));
    for (const n of notes ?? []) {
      const lid = n.leadId as string;
      noteCountByLead.set(lid, (noteCountByLead.get(lid) ?? 0) + 1);
    }
  }

  const decorated = leads.map((l) => ({
    ...l,
    flaggedByMe: flaggedSet.has(l.id),
    noteCount: noteCountByLead.get(l.id) ?? 0,
  }));

  return NextResponse.json({ leads: decorated, total: count ?? 0, countryCounts });
}
