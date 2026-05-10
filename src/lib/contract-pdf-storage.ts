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
import { getContractBody } from "@/lib/contract-template-server";
import { renderContractPdf } from "@/lib/contract-pdf";
import { contractPdfPath } from "@/lib/contract-numbering";

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
