/** Session preparation checklist — Phase D.1 of the v5 redesign.
 *
 *  GET    /api/sessions/[id]/prep
 *    Returns the checklist for this session. Seeds 4 default items on
 *    first read (materi terbaca / catatan sesi lalu / meet link / dokumen).
 *
 *  PATCH  /api/sessions/[id]/prep
 *    Body: { items: PrepItem[] }
 *    Replaces the items array. Used when mentor checks off entries. */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export interface PrepItem {
  id: string;
  label: string;
  sub?: string;
  done: boolean;
  category: "dokumen" | "agenda" | "review" | "meet" | "lainnya";
  warn?: boolean;            // render as amber if true (missing doc style)
  actionLink?: string;       // optional ?wa=... or path to open
  actionLabel?: string;
}

const DEFAULT_ITEMS = (sessionNum: number): PrepItem[] => [
  {
    id: "materi",
    label: `Materi Sesi ${sessionNum} sudah dibaca`,
    sub: "Buka kembali ringkasan kurikulum sebelum sesi",
    done: false,
    category: "review",
    actionLink: "/dashboard/resources",
    actionLabel: "buka materi →",
  },
  {
    id: "prev",
    label: `Catatan Sesi ${Math.max(1, sessionNum - 1)} sudah di-review`,
    sub: "Apa janji + action items yang carry-forward?",
    done: false,
    category: "review",
  },
  {
    id: "meet",
    label: "Link Google Meet sudah dibuat",
    sub: "Otomatis di-paste ke sesi",
    done: false,
    category: "meet",
  },
  {
    id: "docs",
    label: "Dokumen mentee terbaru",
    sub: "CV, motivation letter draft, dst.",
    done: false,
    category: "dokumen",
  },
];

async function checkAccess(sessionId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: session } = await supabase
    .from("Session")
    .select("id, sessionNum, pairingId")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 }) };

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId")
    .eq("id", session.pairingId)
    .maybeSingle();
  if (!pairing) return { error: NextResponse.json({ error: "Pairing tidak ditemukan." }, { status: 404 }) };

  if (user.role !== "admin" && pairing.mentorId !== user.userId && pairing.menteeId !== user.userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, session, pairing };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await checkAccess(id);
  if (access.error) return access.error;
  const { session } = access;

  let { data: row } = await supabase
    .from("SessionPrepChecklist")
    .select("items")
    .eq("sessionId", id)
    .maybeSingle();

  if (!row) {
    const items = DEFAULT_ITEMS(session.sessionNum);
    const nowIso = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("SessionPrepChecklist")
      .insert({
        id: globalThis.crypto.randomUUID(),
        sessionId: id,
        items,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select("items")
      .single();
    if (error) {
      console.error("[prep] seed failed", error);
      return NextResponse.json({ items });
    }
    row = created;
  }

  return NextResponse.json({ items: row.items as PrepItem[] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await checkAccess(id);
  if (access.error) return access.error;

  const body = await req.json();
  const items = body.items as PrepItem[];
  if (!Array.isArray(items)) return NextResponse.json({ error: "items required" }, { status: 400 });

  // Upsert: insert on first save (in case the row was never seeded), update otherwise.
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("SessionPrepChecklist")
    .select("id")
    .eq("sessionId", id)
    .maybeSingle();

  if (existing) {
    await supabase.from("SessionPrepChecklist").update({ items, updatedAt: nowIso }).eq("id", existing.id);
  } else {
    await supabase.from("SessionPrepChecklist").insert({
      id: globalThis.crypto.randomUUID(),
      sessionId: id,
      items,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return NextResponse.json({ ok: true });
}
