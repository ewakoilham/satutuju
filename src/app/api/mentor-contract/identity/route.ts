import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { IDENTITY_FIELDS, type PartialIdentity } from "@/lib/contract-template";

// Subset of MentorProfile that the contract identity step writes. We
// whitelist explicitly so callers can't sneak unrelated fields through this
// endpoint (e.g. `role`, `userId`, mentoring-preference fields).
const WRITABLE = new Set<string>(IDENTITY_FIELDS);

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentor") {
    return NextResponse.json({ error: "Hanya mentor yang dapat mengubah data identitas" }, { status: 403 });
  }

  let raw: PartialIdentity;
  try {
    raw = (await req.json()) as PartialIdentity;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  // Reject identity edits once contract is SIGNED (snapshot is frozen).
  const { data: existingContract } = await supabase
    .from("MentorContract")
    .select("status")
    .eq("userId", user.userId)
    .maybeSingle();
  if (existingContract?.status === "SIGNED") {
    return NextResponse.json(
      {
        error:
          "Data identitas tidak dapat diubah setelah kontrak ditandatangani. Hubungi admin untuk pembatalan jika diperlukan.",
      },
      { status: 409 },
    );
  }

  // Whitelist + trim.
  const patch: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!WRITABLE.has(k)) continue;
    if (v == null) {
      patch[k] = null;
      continue;
    }
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    patch[k] = trimmed.length === 0 ? null : trimmed;
  }

  // Upsert MentorProfile.
  const { data: existing } = await supabase
    .from("MentorProfile")
    .select("id")
    .eq("userId", user.userId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from("MentorProfile")
      .update({ ...patch, updatedAt: now })
      .eq("userId", user.userId)
      .select(
        "fullName,placeOfBirth,dateOfBirth,idType,idNumber,npwp,legalAddress,phoneNumber",
      )
      .single();
    if (error) {
      console.error("MentorProfile identity update error:", error);
      return NextResponse.json(
        { error: "Gagal menyimpan data identitas" },
        { status: 500 },
      );
    }
    return NextResponse.json({ identity: data });
  }

  const { data, error } = await supabase
    .from("MentorProfile")
    .insert({
      id: crypto.randomUUID(),
      userId: user.userId,
      ...patch,
      createdAt: now,
      updatedAt: now,
    })
    .select(
      "fullName,placeOfBirth,dateOfBirth,idType,idNumber,npwp,legalAddress,phoneNumber",
    )
    .single();
  if (error) {
    console.error("MentorProfile identity insert error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan data identitas" },
      { status: 500 },
    );
  }
  return NextResponse.json({ identity: data });
}
