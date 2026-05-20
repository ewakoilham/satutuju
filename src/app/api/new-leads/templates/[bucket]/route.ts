import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_EMAIL_TEMPLATE_COLUMNS } from "@/lib/db-columns";
import { TEMPLATE_BUCKETS, type TemplateBucket } from "@/lib/leads/types";

/**
 * Update one email template's subject + body. Increments `version`
 * and stamps `updatedBy` with the current admin's userId.
 *
 * Body: { subject: string; body: string }
 *
 * Send-time snapshot: OutreachLog already copies subject+body at send
 * time, so we DON'T version-pin per-send. The template here always
 * reflects the latest copy admin saved.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bucket: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { bucket } = await params;
  if (!(TEMPLATE_BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json(
      { error: `bucket must be one of: ${TEMPLATE_BUCKETS.join(", ")}` },
      { status: 400 },
    );
  }

  let body: { subject?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.subject !== "string" || !body.subject.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Fetch current version to increment safely. (No racy CAS — admin
  // panel is single-operator in practice, so last-write-wins is fine.)
  const { data: existing, error: lookupErr } = await supabase
    .from("LeadEmailTemplate")
    .select("version")
    .eq("bucket", bucket as TemplateBucket)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("LeadEmailTemplate")
    .update({
      subject: body.subject.trim(),
      body: body.body,  // preserve whitespace — line breaks are part of the message
      version: (existing.version ?? 0) + 1,
      updatedAt: now,
      updatedBy: user.userId,
    })
    .eq("bucket", bucket as TemplateBucket)
    .select(LEAD_EMAIL_TEMPLATE_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ template: updated });
}
