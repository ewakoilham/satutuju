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
config(); // .env must load before importing modules that read env at init

import { supabase } from "../../src/lib/supabase";
import type { IdentitySnapshot } from "../../src/lib/contract-template";
import { renderAndUploadContractPdf } from "../../src/lib/contract-pdf-storage";

async function main() {
  console.log("Fetching SIGNED contracts…");
  const { data: rows, error } = await supabase
    .from("MentorContract")
    .select(
      "userId,contractNumber,signatureDataUrl,identitySnapshot,signedAt,pdfPath,status",
    )
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

  for (const row of rows) {
    const label = `${row.contractNumber} (user ${row.userId})`;
    if (!row.signatureDataUrl || !row.identitySnapshot || !row.signedAt) {
      console.warn(`✗ ${label}: incomplete row, skipping.`);
      continue;
    }
    const { pdfPath, error: pdfError } = await renderAndUploadContractPdf({
      userId: row.userId,
      identity: row.identitySnapshot as IdentitySnapshot,
      signatureDataUrl: row.signatureDataUrl,
      contractNumber: row.contractNumber,
      signedAt: new Date(row.signedAt),
    });
    if (pdfError || !pdfPath) {
      console.error(`✗ ${label}: ${pdfError}`);
      continue;
    }

    const { error: updErr } = await supabase
      .from("MentorContract")
      .update({ pdfPath, updatedAt: new Date().toISOString() })
      .eq("userId", row.userId);
    if (updErr) {
      console.error(`✗ ${label}: row update failed — ${updErr.message}`);
      continue;
    }
    console.log(`✓ ${label}: regenerated → ${pdfPath}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
