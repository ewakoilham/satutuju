/** Mentee → SatuTuju (admin) general feedback.
 *
 *  POST /api/feedback  — any authenticated user submits { category, message,
 *    anonymous }. Stored in the Feedback table; all admins are notified.
 *  GET  /api/feedback  — admin only; lists submissions (newest first). The
 *    submitter name is hidden for anonymous entries.
 *
 *  Separate from per-session mentor ratings (Session.mentorRating).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const CATEGORIES = new Set(["Saran", "Kendala", "Lainnya"]);
const MAX_LEN = 2000;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const category = String(body.category || "").trim();
  const message = String(body.message || "").trim();
  const anonymous = body.anonymous === true;

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
  }
  if (message.length < 3) {
    return NextResponse.json({ error: "Pesan terlalu pendek." }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `Maksimum ${MAX_LEN} karakter.` }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("Feedback").insert({
    id: crypto.randomUUID(),
    menteeId: user.userId,
    category,
    message,
    anonymous,
    status: "new",
    createdAt: nowIso,
  });
  if (error) {
    console.error("[feedback] insert failed", error);
    return NextResponse.json({ error: "Gagal mengirim masukan." }, { status: 500 });
  }

  // Notify all admins (best-effort).
  try {
    const { data: admins } = await supabase.from("User").select("id").eq("role", "admin");
    const from = anonymous ? "Seseorang" : user.name;
    const snippet = message.length > 90 ? `${message.slice(0, 90)}…` : message;
    for (const a of admins || []) {
      await supabase.from("Notification").insert({
        id: crypto.randomUUID(),
        userId: a.id,
        title: `Masukan baru · ${category}`,
        message: `${from}: ${snippet}`,
        type: "feedback",
        read: false,
        link: "/dashboard/admin/feedback",
        createdAt: nowIso,
      });
    }
  } catch (e) {
    console.error("[feedback] admin notify failed", e);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("Feedback")
    .select("id, category, message, anonymous, status, createdAt, mentee:User!menteeId(name, email)")
    .order("createdAt", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[feedback] list failed", error);
    return NextResponse.json({ error: "Gagal memuat masukan." }, { status: 500 });
  }

  const items = (data || []).map((r: Record<string, unknown>) => {
    const mentee = r.mentee as { name?: string; email?: string } | null;
    return {
      id: r.id as string,
      category: r.category as string,
      message: r.message as string,
      anonymous: r.anonymous as boolean,
      status: r.status as string,
      createdAt: r.createdAt as string,
      from: r.anonymous ? "Anonim" : (mentee?.name || "—"),
      email: r.anonymous ? null : (mentee?.email || null),
    };
  });
  return NextResponse.json({ items });
}
