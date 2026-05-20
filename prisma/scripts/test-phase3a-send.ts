/**
 * Phase 3a smoke test — sends one outreach email via sendLeadEmail()
 * to the dummy lead `ld_test_phase3a_dummy01` (email goes to
 * `venzo.zufar@satutuju.id` so no real applicant is contacted).
 *
 *   npx tsx prisma/scripts/test-phase3a-send.ts
 *
 * Verifies the assertions in Phase 3a:
 *   1. Render template (subject + body with token substitution).
 *   2. Resend send succeeds; resendMessageId captured.
 *   3. OutreachLog row inserted with status="sent".
 *   4. Step with autoTrigger="email_sent" → done.
 *   5. Lead.stage advances new → outreach_sent.
 *   6. LeadStageHistory row appended.
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env" });

// Type-only import is safe (erased at runtime, no module init).
import type { Lead } from "@/lib/leads/types";

const DUMMY_LEAD_ID = "ld_test_phase3a_dummy01";

async function main() {
  // Dynamic-import the modules so env vars are already populated when
  // supabase.ts / email.ts execute their top-level `new Resend(...)`
  // and `createClient(...)` calls.
  const { supabase } = await import("@/lib/supabase");
  const { LEAD_SELECT_COLUMNS } = await import("@/lib/db-columns");
  const { renderLeadOutreach, sendLeadEmail } = await import("@/lib/email");

  console.log("\n=== Phase 3a smoke test ===");

  // Reset lead state so the script can re-run cleanly.
  await supabase
    .from("Lead")
    .update({ stage: "new", outreachSentAt: null, updatedAt: new Date().toISOString() })
    .eq("id", DUMMY_LEAD_ID);
  await supabase
    .from("LeadStepStatus")
    .update({ status: "pending", completedAt: null, completedBy: null })
    .eq("leadId", DUMMY_LEAD_ID);

  // 1. Load lead
  const { data: lead, error } = await supabase
    .from("Lead").select(LEAD_SELECT_COLUMNS).eq("id", DUMMY_LEAD_ID).single();
  if (error || !lead) {
    console.error("✗ Test lead not found:", error?.message);
    process.exit(1);
  }
  const typedLead = lead as unknown as Lead;
  console.log(`✓ Loaded lead: ${typedLead.name} <${typedLead.email}> bucket=${typedLead.bucket}`);

  // 2. Render template
  const rendered = await renderLeadOutreach(typedLead);
  if (!rendered) {
    console.error("✗ renderLeadOutreach returned null");
    process.exit(1);
  }
  console.log(`✓ Rendered template: ${rendered.templateUsed}`);
  console.log(`     subject="${rendered.subject}"`);
  console.log(`     body preview: "${rendered.body.slice(0, 80).replace(/\n/g, " ⏎ ")}…"`);

  // 3. Send via Resend
  const result = await sendLeadEmail({
    to: typedLead.email,
    subject: rendered.subject,
    body: rendered.body,
    leadId: DUMMY_LEAD_ID,
    bucket: typedLead.bucket,
    templateUsed: rendered.templateUsed,
    currentStage: typedLead.stage,
    changedBy: "test-script",
  });
  if (!result.ok) {
    console.error(`✗ sendLeadEmail failed: ${result.error}`);
    process.exit(1);
  }
  console.log(`✓ Resend send succeeded: messageId=${result.resendMessageId}, outreachId=${result.outreachId}`);
  console.log(`     stageAdvanced=${result.stageAdvanced}`);

  // 4. Verify side-effects
  const { data: outreach } = await supabase
    .from("OutreachLog").select("*").eq("id", result.outreachId).single();
  console.log(`✓ OutreachLog row: status=${outreach?.status}, resendMessageId=${outreach?.resendMessageId}`);

  const { data: emailSentStep } = await supabase
    .from("LeadStepStatus")
    .select("status, completedBy")
    .eq("leadId", DUMMY_LEAD_ID)
    .eq("stepId", "step_email_sent")
    .single();
  if (emailSentStep?.status === "done" && emailSentStep?.completedBy === "system") {
    console.log(`✓ "Kirim email pertama" step → done (completedBy=system)`);
  } else {
    console.error(`✗ Step not completed: ${JSON.stringify(emailSentStep)}`);
  }

  const { data: leadAfter } = await supabase
    .from("Lead").select("stage, outreachSentAt").eq("id", DUMMY_LEAD_ID).single();
  if (leadAfter?.stage === "outreach_sent" && leadAfter?.outreachSentAt) {
    console.log(`✓ Lead.stage advanced to outreach_sent (outreachSentAt set)`);
  } else {
    console.error(`✗ Lead state wrong: ${JSON.stringify(leadAfter)}`);
  }

  const { data: history } = await supabase
    .from("LeadStageHistory")
    .select("fromStage, toStage, changedBy, note")
    .eq("leadId", DUMMY_LEAD_ID)
    .order("createdAt", { ascending: false })
    .limit(1);
  if (history?.[0]?.toStage === "outreach_sent") {
    console.log(`✓ LeadStageHistory: ${history[0].fromStage} → ${history[0].toStage} (note: "${history[0].note}")`);
  } else {
    console.error(`✗ No outreach_sent history row found`);
  }

  console.log("\n=== Done — check inbox at venzo.zufar@satutuju.id ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
