import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_AUTO_SEND_SETTING_COLUMNS } from "@/lib/db-columns";

const MIN_DELAY = 5;
const MAX_DELAY = 10080; // 1 week in minutes

/**
 * Read + update the singleton LeadAutoSendSetting row. Single row keyed
 * `id="singleton"`. Admin uses this to gate the auto-send cron.
 */

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { data, error } = await supabase
    .from("LeadAutoSendSetting")
    .select(LEAD_AUTO_SEND_SETTING_COLUMNS)
    .eq("id", "singleton")
    .single();
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Default row if the migration hasn't inserted one yet.
  if (!data) {
    return NextResponse.json({
      id: "singleton",
      enabled: false,
      delayMinutes: 60,
      lastRunAt: null,
      updatedAt: null,
      updatedBy: null,
    });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { enabled?: unknown; delayMinutes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }
  const delay = Number(body.delayMinutes);
  if (!Number.isFinite(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
    return NextResponse.json(
      { error: `delayMinutes must be between ${MIN_DELAY} and ${MAX_DELAY}` },
      { status: 400 },
    );
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("LeadAutoSendSetting")
    .upsert({
      id: "singleton",
      enabled: body.enabled,
      delayMinutes: Math.round(delay),
      updatedAt: now,
      updatedBy: user.userId,
    }, { onConflict: "id" })
    .select(LEAD_AUTO_SEND_SETTING_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
