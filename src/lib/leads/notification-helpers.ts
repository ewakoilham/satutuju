import "server-only";

import { supabase } from "@/lib/supabase";

/**
 * Notification helpers for the lead-collaboration domain (Phase 13).
 *
 * Existing pattern (see /api/pairings/[id]/route.ts) inserts a single
 * Notification row per recipient. These helpers wrap that for the two
 * recipient shapes we need:
 *
 *   - notifyOne(userId, …)   — direct DM
 *   - notifyAllAdmins(…)     — fan out one row per active admin
 *
 * Both are best-effort: errors are swallowed and logged because a
 * notification miss should never roll back the underlying mutation
 * (note posted, flag toggled, etc.).
 */

function notifId(): string {
  return "ntf_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

interface NotifPayload {
  title: string;
  message: string;
  type: string;
  link: string;
}

export async function notifyOne(userId: string, payload: NotifPayload): Promise<void> {
  const { error } = await supabase.from("Notification").insert({
    id: notifId(),
    userId,
    read: false,
    createdAt: new Date().toISOString(),
    ...payload,
  });
  if (error) console.error("[notifyOne]", error.message);
}

export async function notifyAllAdmins(payload: NotifPayload): Promise<void> {
  const { data: admins, error: lookupErr } = await supabase
    .from("User")
    .select("id")
    .eq("role", "admin");
  if (lookupErr) {
    console.error("[notifyAllAdmins] admin lookup failed", lookupErr.message);
    return;
  }
  if (!admins || admins.length === 0) return;
  const now = new Date().toISOString();
  const rows = admins.map((a) => ({
    id: notifId(),
    userId: a.id as string,
    read: false,
    createdAt: now,
    ...payload,
  }));
  const { error } = await supabase.from("Notification").insert(rows);
  if (error) console.error("[notifyAllAdmins]", error.message);
}
