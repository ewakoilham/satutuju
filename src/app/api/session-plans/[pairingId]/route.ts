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

async function resolveAccess(pairingId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const pairing = await loadPairing(pairingId);
  if (!pairing) return { error: NextResponse.json({ error: "Pairing not found" }, { status: 404 }) };
  const isAdmin = user.role === "admin";
  const isMentor = pairing.mentorId === user.userId;
  const isMentee = pairing.menteeId === user.userId;
  return { user, pairing, isAdmin, isMentor, isMentee };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const a = await resolveAccess(pairingId);
  if (a.error) return a.error;
  // Mentor/admin edit; mentee reads only.
  if (!a.isAdmin && !a.isMentor && !a.isMentee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canEdit = a.isAdmin || a.isMentor;

  const { data: existing } = await supabase
    .from("SessionPlan")
    .select("id, pairingId, status, rows, finalizedAt, acknowledgedAt, createdAt, updatedAt")
    .eq("pairingId", pairingId)
    .maybeSingle();
  let plan = existing;

  // Mentee view is read-only and only sees a finalized plan — never seed a
  // draft on their behalf, and don't expose the mentor's in-progress draft.
  if (!canEdit) {
    if (!plan || plan.status === "draft") return NextResponse.json({ plan: null });
    return NextResponse.json({ plan });
  }

  // Mentor/admin: seed on first read so they land on the editable default.
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
  const a = await resolveAccess(pairingId);
  if (a.error) return a.error;
  if (!a.isAdmin && !a.isMentor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
