/**
 * Shared "render the contract PDF and upload it to Supabase storage"
 * pipeline. Used by:
 *   - POST /api/mentor-contract (first sign / re-sign)
 *   - POST /api/mentor-contract/regenerate-pdf (admin or mentor refresh)
 *   - prisma/scripts/regenerate-contract-pdfs.ts (one-off backfill)
 *
 * Best-effort by design: any failure in render or upload is captured and
 * returned as an `error` string, leaving callers free to persist the
 * signature record without a PDF and surface the error to the operator.
 */

import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import {
  interpolateContract,
  type IdentitySnapshot,
} from "@/lib/contract-template";
import {
  interpolateMenteeContract,
  type MenteeIdentitySnapshot,
} from "@/lib/mentee-contract-template";
import { getContractBody } from "@/lib/contract-template-server";
import { getMenteeContractBody } from "@/lib/mentee-contract-template-server";
import { renderContractPdf } from "@/lib/contract-pdf";
import {
  contractPdfPath,
  menteeContractPdfPath,
} from "@/lib/contract-numbering";

export type RenderAndUploadArgs = {
  userId: string;
  identity: IdentitySnapshot;
  signatureDataUrl: string;
  contractNumber: string;
  signedAt: Date;
};

export type RenderAndUploadResult = {
  pdfPath: string | null;
  error: string | null;
};

export async function renderAndUploadContractPdf(
  args: RenderAndUploadArgs,
): Promise<RenderAndUploadResult> {
  try {
    const body = await getContractBody();
    const interpolated = interpolateContract(body, {
      identity: args.identity,
      contractNumber: args.contractNumber,
      signedAt: args.signedAt,
    });
    const buffer = await renderContractPdf({
      interpolatedBody: interpolated,
      identity: args.identity,
      signatureDataUrl: args.signatureDataUrl,
      contractNumber: args.contractNumber,
      kind: "mentor",
    });

    const path = contractPdfPath(args.userId, args.contractNumber);
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (upload.error) {
      throw new Error(`Storage upload failed: ${upload.error.message}`);
    }
    return { pdfPath: path, error: null };
  } catch (e) {
    return {
      pdfPath: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Phase 18: mentee variant ────────────────────────────────────────────

export type RenderAndUploadMenteeArgs = {
  userId: string;
  identity: MenteeIdentitySnapshot;
  /** Captured from the User.email column at sign time. The mentee template
   *  preamble interpolates this — MenteeProfile doesn't store email. */
  email: string;
  signatureDataUrl: string;
  contractNumber: string;
  signedAt: Date;
};

export async function renderAndUploadMenteeContractPdf(
  args: RenderAndUploadMenteeArgs,
): Promise<RenderAndUploadResult> {
  try {
    const body = await getMenteeContractBody();
    const interpolated = interpolateMenteeContract(body, {
      identity: args.identity,
      email: args.email,
      contractNumber: args.contractNumber,
      signedAt: args.signedAt,
    });
    const buffer = await renderContractPdf({
      interpolatedBody: interpolated,
      identity: args.identity,
      signatureDataUrl: args.signatureDataUrl,
      contractNumber: args.contractNumber,
      kind: "mentee",
    });

    const path = menteeContractPdfPath(args.userId, args.contractNumber);
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (upload.error) {
      throw new Error(`Storage upload failed: ${upload.error.message}`);
    }
    return { pdfPath: path, error: null };
  } catch (e) {
    return {
      pdfPath: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
