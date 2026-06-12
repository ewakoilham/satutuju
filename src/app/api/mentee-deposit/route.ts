import { NextRequest, NextResponse } from "next/server";
import { supabase, DEPOSIT_PROOF_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { sniffImage } from "@/lib/image-sniff";
import {
  DEPOSIT_AMOUNT_IDR,
  DEPOSIT_BANK,
  DEPOSIT_CONFIRMATION_KEYS,
} from "@/lib/deposit-terms";

export const runtime = "nodejs";

/**
 * Phase 19 — mentee deposit API (Pasal 9 Perjanjian Layanan Mentoring).
 *
 *   GET  → own deposit row + bank info (admin: ?userId= override)
 *   POST → upload bukti transfer (multipart) + frozen Pasal 9 consent.
 *          Status jumps straight to UPLOADED (the hard gate opens without
 *          waiting for admin verification); a later admin reject closes it.
 */

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — proof screenshots run larger than avatars
const MAX_NOTE_LENGTH = 500;

type DepositRow = {
  id: string;
  userId: string;
  status: string;
  amount: number;
  proofPath: string | null;
  proofUploadedAt: string | null;
  confirmations: Record<string, unknown> | null;
  transferNote: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  rejectionCount: number;
  history: Array<Record<string, unknown>> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Missing-table fallback: treat as "no deposit yet" pre-migration. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function fetchDeposit(userId: string): Promise<DepositRow | null> {
  const { data, error } = await supabase
    .from("MenteeDeposit")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) {
      console.warn(
        "[mentee-deposit] MenteeDeposit table missing — apply Phase 19 migration. Continuing with no deposit.",
      );
      return null;
    }
    console.error("MenteeDeposit fetch error:", error);
    throw new Error(error.message);
  }
  return (data as DepositRow | null) ?? null;
}

// ─── GET /api/mentee-deposit ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mentees are restricted to their own record by ignoring any userId param.
  const requested = req.nextUrl.searchParams.get("userId");
  const targetUserId = user.role === "admin" && requested ? requested : user.userId;

  try {
    const deposit = await fetchDeposit(targetUserId);
    return NextResponse.json(
      {
        deposit,
        bank: {
          bank: DEPOSIT_BANK.bank,
          accountNumber: DEPOSIT_BANK.accountNumber,
          accountHolder: DEPOSIT_BANK.accountHolder,
        },
        amount: DEPOSIT_AMOUNT_IDR,
      },
      { headers: { "Cache-Control": "private, no-store, must-revalidate" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/mentee-deposit ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee") {
    return NextResponse.json(
      { error: "Hanya mentee yang dapat mengunggah bukti deposit" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body harus multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Bukti transfer wajib dilampirkan" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 5 MB" },
      { status: 400 },
    );
  }

  // All three Pasal 9 consents must be ticked; frozen onto the row.
  let confirmations: Record<string, unknown>;
  try {
    confirmations = JSON.parse((formData.get("confirmations") as string) ?? "{}");
  } catch {
    return NextResponse.json({ error: "Format persetujuan tidak valid" }, { status: 400 });
  }
  const allConfirmed = DEPOSIT_CONFIRMATION_KEYS.every(
    (k) => confirmations[k] === true,
  );
  if (!allConfirmed) {
    return NextResponse.json(
      { error: "Semua pernyataan persetujuan harus dicentang" },
      { status: 400 },
    );
  }

  const transferNote = ((formData.get("transferNote") as string) ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;

  // Verify the actual file contents — not the client-supplied MIME/name.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Hanya gambar JPEG, PNG, atau WebP yang diperbolehkan" },
      { status: 400 },
    );
  }

  try {
    const existing = await fetchDeposit(user.userId);
    if (existing && existing.status === "VERIFIED") {
      return NextResponse.json(
        { error: "Deposit sudah terverifikasi — tidak perlu mengunggah ulang" },
        { status: 409 },
      );
    }

    // Each upload gets a fresh path (no upsert) so prior/rejected proofs
    // are retained in storage for audit. The bucket is PRIVATE — proofs are
    // financial data, only served through the authed /proof stream.
    const proofPath = `mentee-deposits/${user.userId}/proof-${Date.now()}.${sniffed.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(DEPOSIT_PROOF_BUCKET)
      .upload(proofPath, bytes, { contentType: sniffed.contentType });
    if (uploadError) {
      console.error("[mentee-deposit] proof upload error:", uploadError);
      return NextResponse.json(
        { error: "Gagal mengunggah bukti transfer" },
        { status: 500 },
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") ?? null;

    const now = new Date().toISOString();
    const historyEntry = {
      action: "upload",
      at: now,
      by: user.userId,
      proofPath,
    };
    const payload = {
      status: "UPLOADED",
      amount: DEPOSIT_AMOUNT_IDR,
      proofPath,
      proofUploadedAt: now,
      confirmations: { ...confirmations, confirmedAt: now },
      transferNote,
      // A fresh upload supersedes a rejection; rejectionCount is kept for audit.
      rejectedAt: null,
      rejectedReason: null,
      history: [...(existing?.history ?? []), historyEntry],
      ipAddress,
      userAgent,
      updatedAt: now,
    };

    let saved: DepositRow | null = null;
    if (existing) {
      const { data, error } = await supabase
        .from("MenteeDeposit")
        .update(payload)
        .eq("userId", user.userId)
        .select()
        .single();
      if (error) {
        console.error("MenteeDeposit update error:", error);
        return NextResponse.json({ error: "Gagal menyimpan deposit" }, { status: 500 });
      }
      saved = data as DepositRow;
    } else {
      const { data, error } = await supabase
        .from("MenteeDeposit")
        .insert({
          id: crypto.randomUUID(),
          userId: user.userId,
          createdAt: now,
          ...payload,
        })
        .select()
        .single();
      if (error) {
        console.error("MenteeDeposit insert error:", error);
        return NextResponse.json({ error: "Gagal menyimpan deposit" }, { status: 500 });
      }
      saved = data as DepositRow;
    }

    return NextResponse.json({ deposit: saved });
  } catch (e) {
    console.error("Upload mentee deposit error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
