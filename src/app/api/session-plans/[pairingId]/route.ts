/** Session plan API — Phase B of the v5 redesign.
 *
 *  GET    /api/session-plans/[pairingId]
 *    Returns the SessionPlan for this pairing. Seeds with the default
 *    10-session template if none exists yet (on first GET).
 *
 *  PATCH  /api/session-plans/[pairingId]
 *    Body: { rows: SessionPlanRow[] }
 *    Replaces the rows array. Status stays as "draft".
 *
 *  POST   /api/session-plans/[pairingId]/finalize
 *    Marks status="finalized", stamps finalizedAt, emails the mentee.
 *
 *  Access control: only the mentor on the pairing (or any admin) may
 *  read/write. The mentee will read it through a separate read-only
 *  endpoint once their dashboard exists. */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  buildDefaultPlan,
  validatePlan,
  type SessionPlanRow,
} from "@/lib/session-plan-defaults";

async function loadPairing(pairingId: string) {
  const { data } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId, mentor:User!mentorId(name), mentee:User!menteeId(name, email)")
    .eq("id", pairingId)
    .maybeSingle();
  return data;
}

async function assertAccess(pairingId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const pairing = await loadPairing(pairingId);
  if (!pairing) return { error: NextResponse.json({ error: "Pairing not found" }, { status: 404 }) };
  const isAdmin = user.role === "admin";
  const isMentor = pairing.mentorId === user.userId;
  if (!isAdmin && !isMentor) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, pairing };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const access = await assertAccess(pairingId);
  if (access.error) return access.error;

  let { data: plan } = await supabase
    .from("SessionPlan")
    .select("id, pairingId, status, rows, finalizedAt, acknowledgedAt, createdAt, updatedAt")
    .eq("pairingId", pairingId)
    .maybeSingle();

  // Seed on first read so the mentor lands on the editable default template.
  if (!plan) {
    const rows = buildDefaultPlan();
    const nowIso = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("SessionPlan")
      .insert({
        id: globalThis.crypto.randomUUID(),
        pairingId,
        status: "draft",
        rows,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select("id, pairingId, status, rows, finalizedAt, acknowledgedAt, createdAt, updatedAt")
      .single();
    if (error) {
      console.error("[session-plans] seed failed", error);
      return NextResponse.json({ error: "Failed to seed plan" }, { status: 500 });
    }
    plan = created;
  }

  return NextResponse.json({ plan });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const access = await assertAccess(pairingId);
  if (access.error) return access.error;

  const body = await req.json();
  const rows = body.rows as SessionPlanRow[] | undefined;
  if (!Array.isArray(rows)) return NextResponse.json({ error: "rows array required" }, { status: 400 });

  const issue = validatePlan(rows);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });

  // Renumber order in case the client reordered without rewriting order.
  const normalized = rows.map((r, i) => ({ ...r, order: i + 1 }));

  const { data: updated, error } = await supabase
    .from("SessionPlan")
    .update({ rows: normalized, updatedAt: new Date().toISOString() })
    .eq("pairingId", pairingId)
    .select("id, pairingId, status, rows, finalizedAt, acknowledgedAt, createdAt, updatedAt")
    .single();

  if (error) {
    console.error("[session-plans] update failed", error);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
  return NextResponse.json({ plan: updated });
}
