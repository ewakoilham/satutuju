import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  MENTEE_IDENTITY_FIELDS,
  type PartialMenteeIdentity,
} from "@/lib/mentee-contract-template";

/**
 * Phase 18 — PUT /api/mentee-contract/identity
 *
 * Persists the mentee's identity fields onto MenteeProfile. Mirrors the
 * mentor identity endpoint but operates on MenteeProfile + remaps
 * `fullName` (form key) ↔ `fullLegalName` (column name).
 */
const WRITABLE = new Set<string>(MENTEE_IDENTITY_FIELDS);

// Form → DB column mapping. Only `fullName` ↔ `fullLegalName` differs; the
// other fields share names between MenteeIdentitySnapshot and the DB row.
const COLUMN_MAP: Record<string, string> = {
  fullName: "fullLegalName",
  placeOfBirth: "placeOfBirth",
  dateOfBirth: "dateOfBirth",
  idType: "idType",
  idNumber: "idNumber",
  legalAddress: "legalAddress",
  phoneNumber: "phoneNumber",
};

const SELECT_COLUMNS =
  "fullLegalName,placeOfBirth,dateOfBirth,idType,idNumber,legalAddress,phoneNumber";

function remapToSnapshot(
  row: Record<string, string | null> | null,
): PartialMenteeIdentity {
  if (!row) return {};
  return {
    fullName: row.fullLegalName ?? undefined,
    placeOfBirth: row.placeOfBirth ?? undefined,
    dateOfBirth: row.dateOfBirth ?? undefined,
    idType: row.idType ?? undefined,
    idNumber: row.idNumber ?? undefined,
    legalAddress: row.legalAddress ?? undefined,
    phoneNumber: row.phoneNumber ?? undefined,
  };
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee") {
    return NextResponse.json(
      { error: "Hanya mentee yang dapat mengubah data identitas" },
      { status: 403 },
    );
  }

  let raw: PartialMenteeIdentity;
  try {
    raw = (await req.json()) as PartialMenteeIdentity;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  // Lock identity once contract is SIGNED (snapshot is frozen).
  const { data: existingContract } = await supabase
    .from("MenteeContract")
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

  // Whitelist + trim + remap to DB column names.
  const patch: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!WRITABLE.has(k)) continue;
    const column = COLUMN_MAP[k];
    if (!column) continue;
    if (v == null) {
      patch[column] = null;
      continue;
    }
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    patch[column] = trimmed.length === 0 ? null : trimmed;
  }

  // Guard against the common mix-up where the NIK/ID number is typed into the
  // name field (or name & number entered swapped). A legal name must contain
  // letters — a bare number is never a valid name.
  const nameVal = patch["fullLegalName"];
  if (typeof nameVal === "string" && nameVal.length > 0 && !/\p{L}/u.test(nameVal)) {
    return NextResponse.json(
      {
        error:
          "Nama Lengkap harus berupa nama, bukan angka/NIK. Isi nama sesuai identitas di kolom Nama Lengkap, dan nomor identitas di kolom Nomor Identitas.",
      },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("MenteeProfile")
    .select("id")
    .eq("userId", user.userId)
    .maybeSingle();

  const now = new Date().toISOString();

  function describeError(err: { code?: string; message?: string }): string {
    if (err.code === "42703" || err.code === "PGRST204") {
      return "Kolom identitas belum ada di database. Apply Phase 18 migration, lalu reload schema di Supabase Dashboard → API → Reload schema.";
    }
    if (err.code === "PGRST205" || err.code === "42P01") {
      return "Tabel MenteeProfile tidak ditemukan oleh PostgREST. Coba reload schema di Supabase Dashboard → API → Reload schema.";
    }
    return `[${err.code ?? "?"}] ${err.message ?? "Gagal menyimpan data identitas"}`;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("MenteeProfile")
      .update({ ...patch, updatedAt: now })
      .eq("userId", user.userId)
      .select(SELECT_COLUMNS)
      .single();
    if (error) {
      console.error("MenteeProfile identity update error:", error);
      return NextResponse.json({ error: describeError(error) }, { status: 500 });
    }
    return NextResponse.json({
      identity: remapToSnapshot(data as Record<string, string | null>),
    });
  }

  const { data, error } = await supabase
    .from("MenteeProfile")
    .insert({
      id: crypto.randomUUID(),
      userId: user.userId,
      ...patch,
      createdAt: now,
      updatedAt: now,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) {
    console.error("MenteeProfile identity insert error:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
  return NextResponse.json({
    identity: remapToSnapshot(data as Record<string, string | null>),
  });
}
