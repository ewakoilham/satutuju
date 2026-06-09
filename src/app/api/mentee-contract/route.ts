import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  MENTEE_CONTRACT_VERSION,
  MENTEE_IDENTITY_FIELDS,
  changelogSinceMentee,
  computeMenteeSignatureHash,
  interpolateMenteeContract,
  isMenteeContractStale,
  isMenteeIdentityComplete,
  menteeIdentityCompleteness,
  type MenteeIdentitySnapshot,
  type PartialMenteeIdentity,
} from "@/lib/mentee-contract-template";
import { getMenteeContractBody } from "@/lib/mentee-contract-template-server";
import { buildContractToc } from "@/lib/contract-template";
import {
  archivedMenteeContractPdfPath,
  nextMenteeContractNumber,
} from "@/lib/contract-numbering";
import { renderAndUploadMenteeContractPdf } from "@/lib/contract-pdf-storage";
import { marked } from "marked";

export const runtime = "nodejs";

/**
 * Phase 18 — mentee contract API. Mirror of /api/mentor-contract, swapping:
 *   - MentorContract / MentorProfile → MenteeContract / MenteeProfile
 *   - mentor role → mentee role
 *   - CONTRACT_VERSION / IDENTITY_FIELDS → MENTEE_* variants
 *   - nextContractNumber → nextMenteeContractNumber
 *   - notification title prefix → "Kontrak Mentee v…"
 *
 * Endpoints:
 *   GET  → fetch own contract + identity + preview HTML (or summary)
 *   POST → sign / re-sign
 */

type ContractRow = {
  id: string;
  userId: string;
  contractNumber: string;
  status: string;
  templateVersion: string;
  identitySnapshot: MenteeIdentitySnapshot | null;
  signatureDataUrl: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  pdfPath: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Missing-table fallback (mirrors mentor): treat 42P01 / PGRST205 as
 * "no contract yet" so the page renders the identity-incomplete flow.
 */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function fetchContract(userId: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from("MenteeContract")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) {
      console.warn(
        "[mentee-contract] MenteeContract table missing — apply Phase 18 migration. Continuing with no contract.",
      );
      return null;
    }
    console.error("MenteeContract fetch error:", error);
    throw new Error(error.message);
  }
  return (data as ContractRow | null) ?? null;
}

async function ensureResignNotification(userId: string, newVersion: string) {
  const title = `Kontrak Mentee v${newVersion} — Tanda tangan ulang`;
  const { data: existing } = await supabase
    .from("Notification")
    .select("id")
    .eq("userId", userId)
    .eq("title", title)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId,
    title,
    message:
      "Perjanjian Layanan Mentoring Mentee telah diperbarui. Tanda tangan Anda yang sebelumnya tetap sah untuk versi lama, namun mohon tanda tangan ulang untuk versi terbaru.",
    type: "alert",
    link: "/dashboard/mentee-contract",
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (error) {
    console.warn("[mentee-contract] notification insert failed:", error);
  }
}

async function fetchProfile(userId: string): Promise<PartialMenteeIdentity> {
  // MenteeProfile uses "fullLegalName" (not "fullName" like MentorProfile),
  // so we project + remap. Phase 18 added "placeOfBirth" and "idType".
  const { data, error } = await supabase
    .from("MenteeProfile")
    .select("fullLegalName,placeOfBirth,dateOfBirth,idType,idNumber,legalAddress,phoneNumber")
    .eq("userId", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    if (error.code === "42703" || error.code === "PGRST204") {
      console.warn(
        "[mentee-contract] MenteeProfile identity columns missing — apply Phase 18 migration.",
      );
      return {};
    }
    console.error("MenteeProfile fetch error:", error);
    throw new Error(error.message);
  }
  if (!data) return {};
  // Remap fullLegalName → fullName to match MenteeIdentitySnapshot shape.
  const row = data as Record<string, string | null>;
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

async function fetchUserEmail(userId: string): Promise<string> {
  const { data } = await supabase
    .from("User")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string) ?? "";
}

// ─── GET /api/mentee-contract ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const summaryOnly = req.nextUrl.searchParams.get("summary") === "1";

  try {
    const [contract, identity, email] = await Promise.all([
      fetchContract(user.userId),
      fetchProfile(user.userId),
      fetchUserEmail(user.userId),
    ]);

    const needsResign = isMenteeContractStale(contract, MENTEE_CONTRACT_VERSION);
    if (needsResign && user.role === "mentee") {
      await ensureResignNotification(user.userId, MENTEE_CONTRACT_VERSION);
    }

    const noStore = { "Cache-Control": "private, no-store, must-revalidate" };

    if (summaryOnly) {
      return NextResponse.json(
        {
          contract,
          identity,
          identityCompleteness: menteeIdentityCompleteness(identity),
          identityRequired: MENTEE_IDENTITY_FIELDS.length,
          contractVersion: MENTEE_CONTRACT_VERSION,
          needsResign,
        },
        { headers: noStore },
      );
    }

    const body = await getMenteeContractBody();
    const previewIdentity = (contract?.identitySnapshot as MenteeIdentitySnapshot | null) ?? {
      fullName: identity.fullName ?? "[Nama Lengkap Mentee]",
      placeOfBirth: identity.placeOfBirth ?? "[tempat]",
      dateOfBirth: identity.dateOfBirth ?? "",
      idType: identity.idType ?? "KTP",
      idNumber: identity.idNumber ?? "________________",
      legalAddress: identity.legalAddress ?? "________________",
      phoneNumber: identity.phoneNumber ?? "________________",
    };
    const interpolated = interpolateMenteeContract(body, {
      identity: previewIdentity as MenteeIdentitySnapshot,
      email,
      contractNumber: contract?.contractNumber ?? "[BELUM DI-ASSIGN]",
      signedAt: contract?.signedAt ? new Date(contract.signedAt) : new Date(),
    });
    const rawHtml = await marked.parse(interpolated);
    const { html: previewHtml, toc: previewToc } = buildContractToc(rawHtml);

    const changelogSinceSigned = needsResign && contract
      ? changelogSinceMentee(contract.templateVersion, MENTEE_CONTRACT_VERSION)
      : [];

    return NextResponse.json(
      {
        contract,
        identity,
        identityCompleteness: menteeIdentityCompleteness(identity),
        identityRequired: MENTEE_IDENTITY_FIELDS.length,
        contractVersion: MENTEE_CONTRACT_VERSION,
        needsResign,
        changelogSinceSigned,
        previewHtml,
        previewToc,
      },
      { headers: noStore },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/mentee-contract ────────────────────────────────────────────

type SignBody = {
  signatureDataUrl?: string;
  confirmations?: {
    authority?: boolean;
    noConflict?: boolean;
    accurate?: boolean;
  };
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee") {
    return NextResponse.json(
      { error: "Hanya mentee yang dapat menandatangani kontrak" },
      { status: 403 },
    );
  }

  let body: SignBody;
  try {
    body = (await req.json()) as SignBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const { signatureDataUrl, confirmations } = body;
  if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Tanda tangan tidak valid" }, { status: 400 });
  }
  if (
    !confirmations?.authority ||
    !confirmations?.noConflict ||
    !confirmations?.accurate
  ) {
    return NextResponse.json(
      { error: "Semua pernyataan persetujuan harus dicentang" },
      { status: 400 },
    );
  }

  try {
    const existing = await fetchContract(user.userId);
    const isResign = isMenteeContractStale(existing, MENTEE_CONTRACT_VERSION);
    if (existing && existing.status === "SIGNED" && !isResign) {
      return NextResponse.json(
        { error: "Kontrak sudah ditandatangani — tidak ada pembaruan untuk ditandatangani ulang" },
        { status: 409 },
      );
    }

    const identityRaw = await fetchProfile(user.userId);
    if (!isMenteeIdentityComplete(identityRaw)) {
      return NextResponse.json(
        { error: "Lengkapi seluruh data identitas sebelum menandatangani" },
        { status: 400 },
      );
    }
    const identity: MenteeIdentitySnapshot = {
      fullName: identityRaw.fullName!.trim(),
      placeOfBirth: identityRaw.placeOfBirth!.trim(),
      dateOfBirth: identityRaw.dateOfBirth!.trim(),
      idType: identityRaw.idType!.trim(),
      idNumber: identityRaw.idNumber!.trim(),
      legalAddress: identityRaw.legalAddress!.trim(),
      phoneNumber: identityRaw.phoneNumber!.trim(),
    };
    const email = await fetchUserEmail(user.userId);

    const signedAt = new Date();
    const contractNumber = isResign && existing
      ? existing.contractNumber
      : await nextMenteeContractNumber(signedAt);
    const signatureHash = await computeMenteeSignatureHash(
      MENTEE_CONTRACT_VERSION,
      identity,
      signatureDataUrl,
    );

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") ?? null;

    // Archive prior PDF on re-sign.
    if (isResign && existing?.pdfPath) {
      const archivePath = archivedMenteeContractPdfPath(
        user.userId,
        existing.templateVersion,
        existing.contractNumber,
      );
      const moveResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .copy(existing.pdfPath, archivePath);
      if (moveResult.error) {
        console.warn(
          `[mentee-contract] could not archive old PDF (${existing.pdfPath} → ${archivePath}):`,
          moveResult.error.message,
        );
      }
    }

    const { pdfPath, error: pdfError } = await renderAndUploadMenteeContractPdf({
      userId: user.userId,
      identity,
      email,
      signatureDataUrl,
      contractNumber,
      signedAt,
    });
    if (pdfError) {
      console.error(
        "[mentee-contract] PDF render/upload failed — saving signed contract without PDF.",
        pdfError,
      );
    }

    const now = signedAt.toISOString();
    const payload = {
      contractNumber,
      status: "SIGNED",
      templateVersion: MENTEE_CONTRACT_VERSION,
      identitySnapshot: identity,
      signatureDataUrl,
      signedAt: now,
      signatureHash,
      ipAddress,
      userAgent,
      pdfPath,
      voidedAt: null,
      voidReason: null,
      updatedAt: now,
    };

    let saved: ContractRow | null = null;
    if (existing) {
      const { data, error } = await supabase
        .from("MenteeContract")
        .update(payload)
        .eq("userId", user.userId)
        .select()
        .single();
      if (error) {
        console.error("MenteeContract update error:", error);
        return NextResponse.json({ error: "Gagal menyimpan kontrak" }, { status: 500 });
      }
      saved = data as ContractRow;
    } else {
      const { data, error } = await supabase
        .from("MenteeContract")
        .insert({
          id: crypto.randomUUID(),
          userId: user.userId,
          createdAt: now,
          ...payload,
        })
        .select()
        .single();
      if (error) {
        console.error("MenteeContract insert error:", error);
        return NextResponse.json({ error: "Gagal menyimpan kontrak" }, { status: 500 });
      }
      saved = data as ContractRow;
    }

    return NextResponse.json({ contract: saved, pdfError });
  } catch (e) {
    console.error("Sign mentee contract error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
