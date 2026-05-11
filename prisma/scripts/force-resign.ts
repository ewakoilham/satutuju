/**
 * One-off: nudge a single mentor's contract back to a stale templateVersion
 * so the resign banner + "Tanda Tangan Ulang" button activate for them.
 *
 *   npx tsx prisma/scripts/force-resign.ts <userId-or-email>
 *
 * Used to test the full re-sign flow (signedAt bump, signature replacement,
 * PDF archive). The audit trail of the prior signing is preserved — only
 * `templateVersion` flips, which is the trigger isContractStale() looks at.
 */

import "dotenv/config";
import { supabase } from "../../src/lib/supabase";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npx tsx prisma/scripts/force-resign.ts <userId-or-email>");
  process.exit(1);
}

async function main() {
  // Resolve identifier: if it looks like an email, look up the user ID first.
  let userId = arg;
  if (arg.includes("@")) {
    const { data: u, error } = await supabase
      .from("User")
      .select("id")
      .eq("email", arg)
      .maybeSingle();
    if (error || !u) {
      console.error(`No user found with email ${arg}`);
      process.exit(1);
    }
    userId = u.id;
  }

  // Show current state so the operator can see exactly what they're touching.
  const { data: before, error: beforeErr } = await supabase
    .from("MentorContract")
    .select("contractNumber,status,templateVersion,signedAt")
    .eq("userId", userId)
    .maybeSingle();
  if (beforeErr || !before) {
    console.error(`No contract found for userId ${userId}`);
    process.exit(1);
  }
  console.log("Before:", before);

  const { error: updErr } = await supabase
    .from("MentorContract")
    .update({
      templateVersion: "2026.05.00", // any value that doesn't match CONTRACT_VERSION
      updatedAt: new Date().toISOString(),
    })
    .eq("userId", userId);
  if (updErr) {
    console.error("Update failed:", updErr);
    process.exit(1);
  }

  console.log("✓ templateVersion set to 2026.05.00 — mentor will now see the resign banner.");
  console.log("  Next: have the mentor click 'Tanda Tangan Ulang' on /dashboard/contract.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
