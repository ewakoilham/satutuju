import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_EMAIL_TEMPLATE_COLUMNS } from "@/lib/db-columns";

/**
 * Admin-only endpoint listing all email templates. Sorted by bucket
 * so the UI renders them in a deterministic order.
 */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { data, error } = await supabase
    .from("LeadEmailTemplate")
    .select(LEAD_EMAIL_TEMPLATE_COLUMNS)
    .order("bucket", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data ?? [] });
}
