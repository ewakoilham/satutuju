import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { fundingPlanLabelId, type Lead } from "@/lib/leads/types";

/**
 * CSV export of leads. Supports two modes:
 *   - `?ids=a,b,c` → export only those lead IDs (used when admin has
 *     a selection in the bulk-action bar)
 *   - all other query params identical to /api/new-leads (bucket,
 *     stage, funding, search, etc.) → export every matching row
 *
 * Format choices:
 *   - UTF-8 with BOM so Excel renders Indonesian + emoji correctly
 *   - RFC 4180-style quoting: every cell wrapped in "", internal "
 *     doubled, line breaks preserved inside quotes
 *   - One header row + one row per lead
 *
 * Columns chosen for operational usefulness — admin can copy/paste
 * subsets into Excel without trimming.
 */

const COLUMNS = [
  "id", "name", "email", "whatsappNumber",
  "bucket", "stage",
  "targetCampusAndProgram", "fundingPlan",
  "parsedCountry", "parsedCampus", "parsedField",
  "hasCountryMentor", "isCampusPartner",
  "assignedInterviewer",
  "outreachSentAt", "emailOpenedAt", "emailClickedAt", "callScheduledAt",
  "submittedAt", "createdAt", "updatedAt",
  "bucketReason",
] as const;

const HUMAN_HEADERS = [
  "ID", "Nama", "Email", "WhatsApp",
  "Bucket", "Stage",
  "Target Kampus/Program", "Funding",
  "Negara", "Kampus (parsed)", "Field",
  "Mentor Available", "Campus Partner",
  "Interviewer",
  "Outreach Sent", "Email Opened", "Email Clicked", "Call Scheduled",
  "Submitted", "Created", "Updated",
  "Bucket Reason",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  // Escape quotes
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  // Jakarta-local for human readability in Excel
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return iso;
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

  let query = supabase.from("Lead").select(LEAD_SELECT_COLUMNS);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  } else {
    // Mirror the filter contract of /api/new-leads (subset)
    const buckets    = searchParams.getAll("bucket");
    const stages     = searchParams.getAll("stage");
    const fundings   = searchParams.getAll("funding");
    const countries  = searchParams.getAll("country");
    const q          = (searchParams.get("q") || "").trim();
    if (buckets.length > 0) query = query.in("bucket", buckets);
    if (stages.length > 0) query = query.in("stage", stages);
    if (fundings.length > 0) query = query.in("fundingPlan", fundings);
    if (countries.length > 0) query = query.in("parsedCountry", countries);
    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,targetCampusAndProgram.ilike.%${q}%`);
    }
  }

  const { data, error } = await query.order("submittedAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Lead[];

  // UTF-8 BOM so Excel doesn't mangle Indonesian characters or emoji.
  const lines: string[] = ["﻿" + HUMAN_HEADERS.map(csvCell).join(",")];
  for (const lead of rows) {
    const cells = COLUMNS.map((col) => {
      const raw = (lead as unknown as Record<string, unknown>)[col];
      switch (col) {
        case "fundingPlan":
          return csvCell(fundingPlanLabelId(String(raw ?? "")));
        case "outreachSentAt":
        case "emailOpenedAt":
        case "emailClickedAt":
        case "callScheduledAt":
        case "submittedAt":
        case "createdAt":
        case "updatedAt":
          return csvCell(formatStamp(raw as string | null));
        case "hasCountryMentor":
          return csvCell(raw === true ? "yes" : raw === false ? "no" : "");
        case "isCampusPartner":
          return csvCell(raw === true ? "yes" : raw === false ? "no" : raw === null ? "?" : "");
        default:
          return csvCell(raw);
      }
    });
    lines.push(cells.join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `satutuju-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
