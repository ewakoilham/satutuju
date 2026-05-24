import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { MENTOR_LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { requireMentor } from "@/lib/leads/auth-guards";
import { getMentorCountry } from "@/lib/mentors";

/**
 * GET /api/mentor/leads — paginated lead list for the mentor surface.
 *
 * Mentor-scoped view. Only the columns in MENTOR_LEAD_SELECT_COLUMNS
 * are returned — never stage/bucket/decision/callNotes/etc. Each lead
 * is decorated with `flaggedByMe`, `noteCount`, plus Phase 16 additions:
 *   - `hasUnreadAdminReply` — admin reply on this lead with createdAt
 *     newer than the mentor's last MentorLeadView.lastViewedAt
 *   - `matchesMyCountry` — `parsedCountry` equals the country the
 *     mentor covers (looked up from src/lib/mentors.ts by user name)
 *
 * Query params:
 *   q              search across name/email/targetCampusAndProgram
 *   flaggedOnly=1  restrict to leads this mentor has flagged
 *   country        Lead.parsedCountry filter. Special value "__none__"
 *                  filters to leads where parsedCountry IS NULL.
 *   match=country  Phase 16: filter to leads whose parsedCountry equals
 *                  the mentor's coverage country. No-op when the mentor
 *                  isn't in MENTORS (returns empty list).
 *   match=unread   Phase 16: filter to leads with unread admin reply.
 *   limit, offset  pagination, capped at 200
 *
 * Response shape (Phase 16 additions marked):
 *   {
 *     leads: [...],             // each decorated with the four fields above
 *     total: int,
 *     countryCounts: { [c]: n }, // ignores `country` filter so dropdown stays stable
 *     stats: {                  // Phase 16 — drives KPI strip + chip counts
 *       totalToday: int,        // submittedAt > today 00:00 Asia/Jakarta
 *       matchMyCountry: int,
 *       unreadReplies: int,
 *       flagged: int,
 *     },
 *     mentorCountry: string | null  // null when mentor not in MENTORS
 *   }
 *
 * Stats are computed against the full leads table (subject to `q` only)
 * so chip counts stay stable as the user toggles filters.
 */

const NONE_KEY = "__none__";

export async function GET(req: NextRequest) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;

  const sp = req.nextUrl.searchParams;
  // Phase 17.1 security fix: escape PostgREST metacharacters in user-
  // supplied search before interpolating into `.or()`. Without escaping,
  // a comma in `q` is parsed as a new OR clause separator — letting a
  // mentor inject filter terms like `,bucket.eq.D` to narrow by
  // admin-only columns (MENTOR_LEAD_SELECT_COLUMNS gates projection,
  // not filtering). Also escape the `%` wildcard so a literal `%` in
  // the query doesn't act like a wildcard. Backslash escapes per
  // PostgREST docs (it follows JSON-ish quoting rules inside or()).
  const rawQ = sp.get("q")?.trim() ?? "";
  const q = sanitizeIlike(rawQ);
  const flaggedOnly = sp.get("flaggedOnly") === "1";
  const countryParam = sp.get("country")?.trim() ?? "";
  const country = countryParam || null;
  const match = sp.get("match")?.trim() ?? "";
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;

  // Phase 16: resolve which country this mentor covers. Email-first
  // (MENTOR_USER_COUNTRY override map), name fallback (legacy MENTORS
  // array match). null = silently degrade — matchesMyCountry stays
  // false for all leads.
  const mentorCountry: string | null = getMentorCountry({
    email: mentor.email,
    name: mentor.name,
  });

  /** Phase 17.1: compute the filter-independent KPI tile values via
   *  cheap head-only count queries. Used both by the main response and
   *  by the empty-result short-circuit branches so the "Jumlah leads
   *  total" tile is always accurate regardless of which chip is
   *  currently selected. */
  async function computeFilterIndependentStats(): Promise<{
    totalAll: number;
    totalToday: number;
    matchMyCountry: number;
    flagged: number;
  }> {
    const todayStart = startOfTodayJakartaIso();
    const baseQ = (col: string) =>
      q ? `${col}.ilike.%${q}%` : null;
    // Three parallel head counts. q-aware. countryMatch + flagged are
    // mentor-scoped — kept here so all four tiles are computed in one
    // place.
    const [totalAllRes, totalTodayRes, matchRes, flaggedRes] = await Promise.all([
      (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let qb: any = supabase.from("Lead").select("id", { count: "exact", head: true });
        if (q) qb = qb.or(`${baseQ("name")},${baseQ("email")},${baseQ("targetCampusAndProgram")}`);
        return qb;
      })(),
      (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let qb: any = supabase
          .from("Lead").select("id", { count: "exact", head: true })
          .gte("submittedAt", todayStart);
        if (q) qb = qb.or(`${baseQ("name")},${baseQ("email")},${baseQ("targetCampusAndProgram")}`);
        return qb;
      })(),
      mentorCountry
        ? (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let qb: any = supabase
            .from("Lead").select("id", { count: "exact", head: true })
            .eq("parsedCountry", mentorCountry);
          if (q) qb = qb.or(`${baseQ("name")},${baseQ("email")},${baseQ("targetCampusAndProgram")}`);
          return qb;
        })()
        : Promise.resolve({ count: 0 }),
      supabase
        .from("MentorLeadFlag")
        .select("leadId", { count: "exact", head: true })
        .eq("mentorId", mentor.userId),
    ]);
    return {
      totalAll: totalAllRes.count ?? 0,
      totalToday: totalTodayRes.count ?? 0,
      matchMyCountry: matchRes.count ?? 0,
      flagged: flaggedRes.count ?? 0,
    };
  }

  // If flaggedOnly, prefilter to the lead ids this mentor has tagged.
  let flaggedIds: string[] | null = null;
  if (flaggedOnly) {
    const { data: flags, error: flagErr } = await supabase
      .from("MentorLeadFlag")
      .select('"leadId"')
      .eq("mentorId", mentor.userId);
    if (flagErr) return NextResponse.json({ error: flagErr.message }, { status: 500 });
    flaggedIds = (flags ?? []).map((f) => f.leadId as string);
    if (flaggedIds.length === 0) {
      const base = await computeFilterIndependentStats();
      return NextResponse.json({
        leads: [],
        total: 0,
        countryCounts: {},
        stats: { ...base, unreadReplies: 0 },
        mentorCountry,
      });
    }
  }

  // Phase 16: when match=unread is requested, we need to restrict to
  // leads with at least one admin reply newer than the mentor's view.
  // Do this as a prefilter (set intersection) so the main query stays
  // a single round-trip.
  let unreadOnlyIds: string[] | null = null;
  if (match === "unread") {
    unreadOnlyIds = await computeUnreadAdminReplyLeadIds(mentor.userId);
    if (unreadOnlyIds.length === 0) {
      return NextResponse.json({
        leads: [],
        total: 0,
        countryCounts: {},
        stats: { ...(await computeFilterIndependentStats()), unreadReplies: 0 },
        mentorCountry,
      });
    }
  }

  /** Apply the filters shared by the main query and the country-counts
   *  aggregation. `withCountry=true` adds the country narrow (used by
   *  the main paginated query). The match=country narrow is also gated
   *  here so the count query stays in sync. */
  function applyFilters<T extends { or: (...a: unknown[]) => T; in: (col: string, vals: unknown[]) => T; eq: (col: string, val: unknown) => T; is: (col: string, val: null) => T }>(
    qb: T,
    withCountry: boolean,
  ): T {
    if (q) {
      qb = qb.or(
        `name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`,
      ) as T;
    }
    // Compose flagged + unread filters as id-set restrictions. Both
    // pre-resolved into arrays above.
    const idRestrictions: string[][] = [];
    if (flaggedIds) idRestrictions.push(flaggedIds);
    if (unreadOnlyIds) idRestrictions.push(unreadOnlyIds);
    if (idRestrictions.length > 0) {
      // Intersect all id restrictions before applying — Supabase doesn't
      // chain .in() calls (each one replaces the prior). When a mentor
      // selects flaggedOnly AND match=unread, we want the AND.
      const intersection = idRestrictions.reduce<string[]>(
        (acc, arr, i) => (i === 0 ? arr.slice() : acc.filter((id) => arr.includes(id))),
        [],
      );
      if (intersection.length === 0) {
        // Caller's combination yields no rows. The outer code can short-
        // circuit; here we just give the query an impossible filter.
        qb = qb.in("id", ["__impossible__"]) as T;
      } else {
        qb = qb.in("id", intersection) as T;
      }
    }
    if (withCountry) {
      if (country === NONE_KEY) qb = qb.is("parsedCountry", null) as T;
      else if (country) qb = qb.eq("parsedCountry", country) as T;
      if (match === "country" && mentorCountry) {
        qb = qb.eq("parsedCountry", mentorCountry) as T;
      }
    }
    return qb;
  }

  // Phase 16 short-circuit: match=country requested but mentor isn't
  // in MENTORS (no country to match against) → return empty.
  if (match === "country" && !mentorCountry) {
    return NextResponse.json({
      leads: [],
      total: 0,
      countryCounts: {},
      stats: { totalToday: 0, matchMyCountry: 0, unreadReplies: 0, flagged: (flaggedIds ?? []).length },
      mentorCountry,
    });
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
  const leads = (leadsRaw ?? []) as unknown as Array<Record<string, unknown> & { id: string; parsedCountry: string | null }>;

  // Aggregation query — same filters MINUS the country narrow + match,
  // so the dropdown options stay stable after a mentor picks a country.
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
  const viewByLead = new Map<string, string>(); // leadId → lastViewedAt ISO
  if (leadIds.length > 0) {
    const [{ data: flags }, { data: notes }, { data: views }] = await Promise.all([
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
      supabase
        .from("MentorLeadView")
        .select('"leadId", "lastViewedAt"')
        .eq("mentorId", mentor.userId)
        .in("leadId", leadIds),
    ]);
    flaggedSet = new Set((flags ?? []).map((f) => f.leadId as string));
    for (const n of notes ?? []) {
      const lid = n.leadId as string;
      noteCountByLead.set(lid, (noteCountByLead.get(lid) ?? 0) + 1);
    }
    for (const v of (views ?? []) as Array<{ leadId: string; lastViewedAt: string }>) {
      viewByLead.set(v.leadId, v.lastViewedAt);
    }
  }

  // Compute hasUnreadAdminReply per visible lead. Phase 17.1 fix: only
  // count admin replies to THIS MENTOR'S own top-level notes — same
  // semantics as computeUnreadAdminReplyLeadIds (used by the chip
  // prefilter + KPI tile) so the row badge and chip count never
  // disagree. Prior version counted ANY reply where authorId !=
  // mentor.userId, which fired badges on threads owned by OTHER mentors
  // (also a small privacy leak: mentor C learns admin activity on
  // mentor B's thread).
  const unreadByLead = new Set<string>();
  if (leadIds.length > 0) {
    // Step 1: find this mentor's own top-level notes on visible leads.
    const { data: myParents } = await supabase
      .from("LeadNote")
      .select('"id", "leadId"')
      .eq("authorId", mentor.userId)
      .is("parentNoteId", null)
      .in("leadId", leadIds);
    const myParentIds = (myParents ?? []).map((p) => p.id as string);
    if (myParentIds.length > 0) {
      // Step 2: replies to THIS mentor's parents only.
      const { data: replies } = await supabase
        .from("LeadNote")
        .select('"leadId", "createdAt"')
        .in("parentNoteId", myParentIds);
      for (const r of (replies ?? []) as Array<{ leadId: string; createdAt: string }>) {
        const lastViewed = viewByLead.get(r.leadId);
        if (!lastViewed || new Date(r.createdAt).getTime() > new Date(lastViewed).getTime()) {
          unreadByLead.add(r.leadId);
        }
      }
    }
  }

  const decorated = leads.map((l) => ({
    ...l,
    flaggedByMe: flaggedSet.has(l.id),
    noteCount: noteCountByLead.get(l.id) ?? 0,
    hasUnreadAdminReply: unreadByLead.has(l.id),
    matchesMyCountry: mentorCountry !== null && l.parsedCountry === mentorCountry,
  }));

  // Phase 16: aggregate stats. Counted across ALL leads (subject to `q`
  // only — chip counts shouldn't shift as the user toggles other
  // chips). Done in JS over a thin column projection so we avoid four
  // separate Postgres roundtrips.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let statsQuery: any = supabase
    .from("Lead")
    .select('id, "parsedCountry", "submittedAt"');
  if (q) {
    statsQuery = statsQuery.or(
      `name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`,
    );
  }
  const { data: statsRows } = await statsQuery;

  const todayStart = startOfTodayJakartaIso();
  let totalAll = 0;
  let totalToday = 0;
  let matchMyCountry = 0;
  for (const r of (statsRows ?? []) as Array<{ id: string; parsedCountry: string | null; submittedAt: string | null }>) {
    totalAll++;
    if (r.submittedAt && r.submittedAt >= todayStart) totalToday++;
    if (mentorCountry && r.parsedCountry === mentorCountry) matchMyCountry++;
  }

  // unreadReplies + flagged are mentor-specific aggregates over ALL
  // leads, not just the current page. Reuse the prefilter helpers.
  const [allFlaggedRes, allUnreadIds] = await Promise.all([
    supabase
      .from("MentorLeadFlag")
      .select('"leadId"', { count: "exact", head: true })
      .eq("mentorId", mentor.userId),
    computeUnreadAdminReplyLeadIds(mentor.userId),
  ]);
  const flagged = allFlaggedRes.count ?? 0;
  const unreadReplies = allUnreadIds.length;

  return NextResponse.json({
    leads: decorated,
    total: count ?? 0,
    countryCounts,
    stats: { totalAll, totalToday, matchMyCountry, unreadReplies, flagged },
    mentorCountry,
  });
}

/** Return the set of lead ids where this mentor has at least one
 *  unread admin reply. "Unread" = admin reply with createdAt newer
 *  than MentorLeadView.lastViewedAt for that lead (or no view row at
 *  all → all admin replies count). */
async function computeUnreadAdminReplyLeadIds(mentorUserId: string): Promise<string[]> {
  // Pull every admin reply where the parent was authored by THIS
  // mentor. Cheaper than scanning the whole LeadNote table.
  const { data: myParents } = await supabase
    .from("LeadNote")
    .select("id, leadId")
    .eq("authorId", mentorUserId)
    .is("parentNoteId", null);
  const myParentIds = new Set((myParents ?? []).map((p) => p.id as string));
  const leadIds = new Set((myParents ?? []).map((p) => p.leadId as string));
  if (leadIds.size === 0) return [];

  const [{ data: replies }, { data: views }] = await Promise.all([
    supabase
      .from("LeadNote")
      .select('"leadId", "parentNoteId", "createdAt"')
      .in("parentNoteId", Array.from(myParentIds)),
    supabase
      .from("MentorLeadView")
      .select('"leadId", "lastViewedAt"')
      .eq("mentorId", mentorUserId)
      .in("leadId", Array.from(leadIds)),
  ]);
  const viewByLead = new Map<string, string>();
  for (const v of (views ?? []) as Array<{ leadId: string; lastViewedAt: string }>) {
    viewByLead.set(v.leadId, v.lastViewedAt);
  }
  const unread = new Set<string>();
  for (const r of (replies ?? []) as Array<{ leadId: string; parentNoteId: string; createdAt: string }>) {
    const lastViewed = viewByLead.get(r.leadId);
    if (!lastViewed || new Date(r.createdAt).getTime() > new Date(lastViewed).getTime()) {
      unread.add(r.leadId);
    }
  }
  return Array.from(unread);
}

/**
 * Phase 17.1: defang PostgREST metacharacters before interpolating user
 * input into `.or(...)` ilike filters. PostgREST parses commas as OR-
 * clause separators and parentheses for grouping; we also escape `%`
 * and `_` so they don't act as ILIKE wildcards. Backslash + the char
 * gets passed through to Postgres which treats `\%` / `\_` as literals
 * in LIKE patterns. Whitespace and unicode letters/digits stay as-is.
 *
 * Returns "" for null/empty; the caller can skip the .or() entirely.
 */
function sanitizeIlike(raw: string): string {
  if (!raw) return "";
  // Strip everything in the PostgREST/SQL danger set. Keep letters,
  // digits, whitespace, `.`, `@`, `-`, `'` (for names like O'Brien).
  // Note: a few of these are SAFE inside `.ilike.<pattern>` but become
  // dangerous when concatenated into the comma-separated or() string.
  // Rather than enumerate which contexts are safe, blacklist anything
  // that looks like a PostgREST operator delimiter.
  return raw
    .replace(/[\\,()%_]/g, " ")  // strip operator/wildcard chars
    .replace(/\s+/g, " ")         // collapse whitespace
    .trim();
}

/** Start-of-today in Asia/Jakarta, returned as a Postgres-compatible
 *  ISO string. Used for the totalToday KPI tile. */
function startOfTodayJakartaIso(): string {
  // Jakarta = UTC+07:00, no DST. Take "now in Jakarta", strip the time,
  // serialize back to UTC. Manual offset math avoids pulling Intl.
  const now = new Date();
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const jakartaNowMs = now.getTime() + jakartaOffsetMs;
  const jakartaNow = new Date(jakartaNowMs);
  jakartaNow.setUTCHours(0, 0, 0, 0);
  const todayStartUtc = new Date(jakartaNow.getTime() - jakartaOffsetMs);
  return todayStartUtc.toISOString();
}
