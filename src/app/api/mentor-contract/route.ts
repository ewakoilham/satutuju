import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  CONTRACT_VERSION,
  IDENTITY_FIELDS,
  changelogSince,
  computeSignatureHash,
  getContractBody,
  interpolateContract,
  isIdentityComplete,
  identityCompleteness,
  type IdentitySnapshot,
  type PartialIdentity,
} from "@/lib/contract-template";
import { nextContractNumber } from "@/lib/contract-numbering";
import { renderContractPdf } from "@/lib/contract-pdf";
import { marked } from "marked";

export const runtime = "nodejs";

type ContractRow = {
  id: string;
  userId: string;
  contractNumber: string;
  status: string;
  templateVersion: string;
  identitySnapshot: IdentitySnapshot | null;
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
 * If the SQL migration at prisma/sql/2026-05-10_mentor_contracts.sql hasn't
 * been applied yet, Supabase returns code "42P01" (undefined_table) or
 * "PGRST205" (schema cache miss). We treat both as "no contract" so the
 * page can still render (mentor sees the identity-incomplete flow) and an
 * unmistakable warning is logged for the operator.
 */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function fetchContract(userId: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from("MentorContract")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) {
      console.warn(
        "[mentor-contract] MentorContract table missing — apply prisma/sql/2026-05-10_mentor_contracts.sql or run `npx prisma db push`. Continuing with no contract.",
      );
      return null;
    }
    console.error("MentorContract fetch error:", error);
    throw new Error(error.message);
  }
  return (data as ContractRow | null) ?? null;
}

/**
 * Idempotently insert a "kontrak diperbarui" notification for the mentor.
 * We dedupe by exact title (which encodes the version), so a second poll
 * for the same template version doesn't spam the bell.
 */
async function ensureResignNotification(userId: string, newVersion: string) {
  const title = `Kontrak Mentor v${newVersion} — Tanda tangan ulang`;
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
      "Perjanjian Kemitraan Mentor telah diperbarui. Tanda tangan Anda yang sebelumnya tetap sah untuk versi lama, namun mohon tanda tangan ulang untuk versi terbaru.",
    type: "alert",
    link: "/dashboard/contract",
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (error) {
    // Notification failure shouldn't break the page load — log and move on.
    console.warn("[mentor-contract] notification insert failed:", error);
  }
}

async function fetchProfile(userId: string): Promise<PartialIdentity> {
  const { data, error } = await supabase
    .from("MentorProfile")
    .select("fullName,placeOfBirth,dateOfBirth,idType,idNumber,npwp,legalAddress,phoneNumber")
    .eq("userId", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    // Postgres "42703 undefined_column" (or PostgREST's PGRST204) means the
    // identity columns haven't been added yet. Fall back to the legacy
    // selection so the page still renders.
    if (error.code === "42703" || error.code === "PGRST204") {
      console.warn(
        "[mentor-contract] MentorProfile identity columns missing — apply prisma/sql/2026-05-10_mentor_contracts.sql. Falling back to fullName only.",
      );
      const fallback = await supabase
        .from("MentorProfile")
        .select("fullName")
        .eq("userId", userId)
        .maybeSingle();
      return (fallback.data as PartialIdentity | null) ?? {};
    }
    console.error("MentorProfile fetch error:", error);
    throw new Error(error.message);
  }
  return (data as PartialIdentity | null) ?? {};
}

// ─── GET /api/mentor-contract ─────────────────────────────────────────────
// Returns the mentor's contract row + identity completeness. If no row
// exists, return null — the row is only created on first POST (signing) so
// unsigned drafts don't burn contract numbers.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentor" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [contract, identity, body] = await Promise.all([
      fetchContract(user.userId),
      fetchProfile(user.userId),
      getContractBody(),
    ]);

    // Render preview HTML. For signed contracts use the frozen snapshot +
    // real number; for drafts use the current (possibly-incomplete)
    // identity + a "[BELUM DI-ASSIGN]" placeholder so the mentor still gets
    // a faithful read-through before signing.
    const previewIdentity = (contract?.identitySnapshot as IdentitySnapshot | null) ?? {
      fullName: identity.fullName ?? "[Nama Lengkap Mentor]",
      placeOfBirth: identity.placeOfBirth ?? "[tempat]",
      dateOfBirth: identity.dateOfBirth ?? "",
      idType: identity.idType ?? "KTP",
      idNumber: identity.idNumber ?? "________________",
      npwp: identity.npwp ?? "________________",
      legalAddress: identity.legalAddress ?? "________________",
      phoneNumber: identity.phoneNumber ?? "",
    };
    const interpolated = interpolateContract(body, {
      identity: previewIdentity as IdentitySnapshot,
      contractNumber: contract?.contractNumber ?? "[BELUM DI-ASSIGN]",
      signedAt: contract?.signedAt ? new Date(contract.signedAt) : new Date(),
    });
    const previewHtml = await marked.parse(interpolated);

    // Version drift detection: an admin update bumps CONTRACT_VERSION;
    // any signed contract whose templateVersion lags becomes "needsResign".
    // We emit a one-shot notification so the mentor sees a heads-up in
    // their bell — guarded by checking for an existing notification with
    // the same title to stay idempotent across page refreshes.
    const needsResign = !!(
      contract &&
      contract.status === "SIGNED" &&
      contract.templateVersion !== CONTRACT_VERSION
    );
    if (needsResign && user.role === "mentor") {
      await ensureResignNotification(user.userId, CONTRACT_VERSION);
    }

    // Changelog of versions strictly newer than what the mentor signed,
    // so the banner can spell out exactly what changed.
    const changelogSinceSigned = needsResign && contract
      ? changelogSince(contract.templateVersion, CONTRACT_VERSION)
      : [];

    return NextResponse.json({
      contract,
      identity,
      identityCompleteness: identityCompleteness(identity),
      identityRequired: IDENTITY_FIELDS.length,
      contractVersion: CONTRACT_VERSION,
      needsResign,
      changelogSinceSigned,
      previewHtml,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/mentor-contract ────────────────────────────────────────────
// Body: { signatureDataUrl, confirmations: { authority, noConflict, accurate } }
// Performs the full sign flow: validates identity completeness, freezes the
// snapshot, assigns a contract number, computes the audit hash, renders the
// PDF, uploads to Supabase, and writes the SIGNED row.

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
  if (user.role !== "mentor") {
    return NextResponse.json({ error: "Hanya mentor yang dapat menandatangani kontrak" }, { status: 403 });
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
    // Re-sign is allowed when the existing signature is on a stale
    // template version. Otherwise a SIGNED row is locked.
    const isResign =
      !!existing &&
      existing.status === "SIGNED" &&
      existing.templateVersion !== CONTRACT_VERSION;
    if (existing && existing.status === "SIGNED" && !isResign) {
      return NextResponse.json(
        { error: "Kontrak sudah ditandatangani — tidak ada pembaruan untuk ditandatangani ulang" },
        { status: 409 },
      );
    }

    const identityRaw = await fetchProfile(user.userId);
    if (!isIdentityComplete(identityRaw)) {
      return NextResponse.json(
        { error: "Lengkapi seluruh data identitas sebelum menandatangani" },
        { status: 400 },
      );
    }
    const identity: IdentitySnapshot = {
      fullName: identityRaw.fullName!.trim(),
      placeOfBirth: identityRaw.placeOfBirth!.trim(),
      dateOfBirth: identityRaw.dateOfBirth!.trim(),
      idType: identityRaw.idType!.trim(),
      idNumber: identityRaw.idNumber!.trim(),
      npwp: identityRaw.npwp!.trim(),
      legalAddress: identityRaw.legalAddress!.trim(),
      phoneNumber: identityRaw.phoneNumber!.trim(),
    };

    const signedAt = new Date();
    // Re-sign keeps the original contract number (it's the same legal
    // contract being executed under the new template version). New
    // signatures only get a fresh sequence number.
    const contractNumber = isResign && existing
      ? existing.contractNumber
      : await nextContractNumber(signedAt);
    const signatureHash = await computeSignatureHash(
      CONTRACT_VERSION,
      identity,
      signatureDataUrl,
    );

    // Audit: capture caller IP + UA. Vercel proxies so x-forwarded-for is
    // the trusted source.
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") ?? null;

    // On re-sign, archive the prior PDF + audit fields so the old
    // signature event remains recoverable for legal review. We only move
    // the PDF in storage (cheap); the in-DB row is overwritten because
    // we don't yet have a history table.
    if (isResign && existing?.pdfPath) {
      const archivePath = `contracts/${user.userId}/history/${existing.templateVersion}_${existing.contractNumber.replace(/\//g, "_")}.pdf`;
      const moveResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .copy(existing.pdfPath, archivePath);
      if (moveResult.error) {
        console.warn(
          `[mentor-contract] could not archive old PDF (${existing.pdfPath} → ${archivePath}):`,
          moveResult.error.message,
        );
      }
    }

    // Render + upload PDF. Both steps are best-effort: the contract is
    // legally valid based on the in-DB audit record (snapshot + hash + IP
    // + UA + signedAt), so we don't want a PDF rendering hiccup to block
    // the mentor from signing. If either step fails we set pdfPath = null
    // and log loudly; the operator can re-render later (a regenerate
    // endpoint can be added without touching the signed row).
    const safeNumber = contractNumber.replace(/\//g, "_");
    let pdfPath: string | null = null;
    let pdfError: string | null = null;
    try {
      const templateBody = await getContractBody();
      const interpolated = interpolateContract(templateBody, {
        identity,
        contractNumber,
        signedAt,
      });
      const pdfBuffer = await renderContractPdf({
        interpolatedBody: interpolated,
        identity,
        signatureDataUrl,
        contractNumber,
      });

      const candidatePath = `contracts/${user.userId}/${safeNumber}.pdf`;
      const upload = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(candidatePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upload.error) {
        throw new Error(`Storage upload failed: ${upload.error.message}`);
      }
      pdfPath = candidatePath;
    } catch (e) {
      pdfError = e instanceof Error ? e.message : String(e);
      console.error(
        "[mentor-contract] PDF render/upload failed — saving signed contract without PDF. Operator can regenerate later.",
        pdfError,
      );
    }

    // Write/update the row.
    const now = signedAt.toISOString();
    const payload = {
      contractNumber,
      status: "SIGNED",
      templateVersion: CONTRACT_VERSION,
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
        .from("MentorContract")
        .update(payload)
        .eq("userId", user.userId)
        .select()
        .single();
      if (error) {
        console.error("MentorContract update error:", error);
        return NextResponse.json({ error: "Gagal menyimpan kontrak" }, { status: 500 });
      }
      saved = data as ContractRow;
    } else {
      const { data, error } = await supabase
        .from("MentorContract")
        .insert({
          id: crypto.randomUUID(),
          userId: user.userId,
          createdAt: now,
          ...payload,
        })
        .select()
        .single();
      if (error) {
        console.error("MentorContract insert error:", error);
        return NextResponse.json({ error: "Gagal menyimpan kontrak" }, { status: 500 });
      }
      saved = data as ContractRow;
    }

    return NextResponse.json({ contract: saved, pdfError });
  } catch (e) {
    console.error("Sign contract error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
