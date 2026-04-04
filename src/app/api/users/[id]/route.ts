import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === admin.userId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Verify user exists
  const { data: target, error: fetchErr } = await supabase
    .from("User")
    .select("id, name, role")
    .eq("id", id)
    .single();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete all pairings where user is mentor or mentee (cascades sessions, documents, tasks, progressNotes)
  await supabase.from("Pairing").delete().eq("mentorId", id);
  await supabase.from("Pairing").delete().eq("menteeId", id);

  // Delete the user (notifications cascade automatically)
  const { error: deleteErr } = await supabase.from("User").delete().eq("id", id);

  if (deleteErr) {
    return NextResponse.json({ error: "Failed to delete user", detail: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
