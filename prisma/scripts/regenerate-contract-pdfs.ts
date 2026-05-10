/**
 * One-off helper: re-render the PDF for every SIGNED MentorContract row
 * and upload it to Supabase storage. Useful after fixing a template bug
 * (e.g. unfilled placeholder) that should propagate to existing contracts.
 *
 * Run with:
 *   npx tsx prisma/scripts/regenerate-contract-pdfs.ts
 *
 * The DB audit trail (hash, IP, signedAt, signatureDataUrl, identitySnapshot)
 * is left untouched — only the PDF file at `pdfPath` is overwritten and
 * `updatedAt` is bumped.
 */

import { config } from "dotenv";
config(); // load .env

import { createClient } from "@supabase/supabase-js";
import {
  getContractBody,
  interpolateContract,
  type IdentitySnapshot,
} from "../../src/lib/contract-template";
import { renderContractPdf } from "../../src/lib/contract-pdf";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = "documents";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Fetching SIGNED contracts…");
  const { data: rows, error } = await supabase
    .from("MentorContract")
    .select("userId,contractNumber,signatureDataUrl,identitySnapshot,signedAt,pdfPath,status")
    .eq("status", "SIGNED");

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("No SIGNED contracts found. Nothing to do.");
    return;
  }
  console.log(`Found ${rows.length} contract(s).`);

  const templateBody = await getContractBody();

  for (const row of rows) {
    const label = `${row.contractNumber} (user ${row.userId})`;
    if (!row.signatureDataUrl || !row.identitySnapshot || !row.signedAt) {
      console.warn(`✗ ${label}: incomplete row, skipping.`);
      continue;
    }
    try {
      const identity = row.identitySnapshot as IdentitySnapshot;
      const interpolated = interpolateContract(templateBody, {
        identity,
        contractNumber: row.contractNumber,
        signedAt: new Date(row.signedAt),
      });
      const pdf = await renderContractPdf({
        interpolatedBody: interpolated,
        identity,
        signatureDataUrl: row.signatureDataUrl,
        contractNumber: row.contractNumber,
      });

      const safeNumber = row.contractNumber.replace(/\//g, "_");
      const pdfPath = row.pdfPath ?? `contracts/${row.userId}/${safeNumber}.pdf`;
      const upload = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(pdfPath, pdf, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upload.error) throw new Error(`Upload: ${upload.error.message}`);

      const { error: updErr } = await supabase
        .from("MentorContract")
        .update({ pdfPath, updatedAt: new Date().toISOString() })
        .eq("userId", row.userId);
      if (updErr) throw new Error(`Row update: ${updErr.message}`);

      console.log(`✓ ${label}: regenerated → ${pdfPath} (${pdf.length} bytes)`);
    } catch (e) {
      console.error(`✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
