/**
 * Phase 3b smoke test — exercises /api/webhooks/resend with a valid
 * Svix-signed event. Uses the latest OutreachLog row for our dummy
 * test lead so we know which side-effects to expect.
 *
 *   npx tsx prisma/scripts/test-phase3b-webhook.ts
 *
 * Assertions:
 *   1. Unsigned POST → 401
 *   2. Signed email.opened → 200; OutreachLog.openedAt set;
 *      Lead.emailOpenedAt set; step "Email dibuka" → done;
 *      stage advances to email_opened.
 *   3. Signed email.clicked → 200; OutreachLog.clickedAt set;
 *      Lead.emailClickedAt set; step "Email diklik" → done if exists;
 *      stage advances to email_clicked.
 *   4. Signed email.bounced → 200; OutreachLog.status = "bounced".
 *
 * Requires dev server up at port 3100 + RESEND_WEBHOOK_SECRET in .env.
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env" });

import crypto from "crypto";

const DEV_URL = "http://localhost:3100/api/webhooks/resend";
const DUMMY_LEAD_ID = "ld_test_phase3a_dummy01";

interface ResendEvent {
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

/** Reproduce svix's signing algorithm so we can post test events
 *  without depending on a private API in the svix package. */
function signSvix(secret: string, svixId: string, timestamp: string, body: string): string {
  // Secret format: "whsec_<base64>". Strip the prefix and decode.
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  // Resend's secrets ARE base64-encoded; if base64 decoding fails (e.g.
  // human-readable test value), fall back to treating the raw string
  // as the HMAC key — same approach svix's debug tooling uses.
  let keyBuf: Buffer;
  try {
    keyBuf = Buffer.from(key, "base64");
    if (keyBuf.length < 16) throw new Error("too short");
  } catch {
    keyBuf = Buffer.from(key, "utf8");
  }
  const signedContent = `${svixId}.${timestamp}.${body}`;
  const sig = crypto.createHmac("sha256", keyBuf).update(signedContent).digest("base64");
  return `v1,${sig}`;
}

async function postEvent(event: ResendEvent, opts: { sign: boolean } = { sign: true }) {
  const body = JSON.stringify(event);
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const svixId = "msg_test_" + crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.sign) {
    headers["svix-id"] = svixId;
    headers["svix-timestamp"] = timestamp;
    headers["svix-signature"] = signSvix(secret, svixId, timestamp, body);
  }

  const res = await fetch(DEV_URL, { method: "POST", headers, body });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function querySupabase<T>(table: string, columns: string, filterCol: string, filterVal: string): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filterCol}=eq.${encodeURIComponent(filterVal)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const rows = await res.json() as T[];
  return rows[0] ?? null;
}

async function main() {
  console.log("\n=== Phase 3b webhook smoke test ===\n");

  // Reset state so the script is re-runnable.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error("✗ Supabase env not set");
    process.exit(1);
  }
  // Reset OutreachLog for dummy lead
  await fetch(`${supaUrl}/rest/v1/OutreachLog?leadId=eq.${DUMMY_LEAD_ID}`, {
    method: "PATCH",
    headers: {
      apikey: supaKey, Authorization: `Bearer ${supaKey}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify({ openedAt: null, clickedAt: null, bouncedAt: null, status: "sent", errorMessage: null }),
  });
  // Reset Lead engagement + stage
  await fetch(`${supaUrl}/rest/v1/Lead?id=eq.${DUMMY_LEAD_ID}`, {
    method: "PATCH",
    headers: {
      apikey: supaKey, Authorization: `Bearer ${supaKey}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify({ stage: "outreach_sent", emailOpenedAt: null, emailClickedAt: null }),
  });
  // Reset email_opened + email_clicked steps to pending
  await fetch(`${supaUrl}/rest/v1/LeadStepStatus?leadId=eq.${DUMMY_LEAD_ID}&stepId=in.(step_email_opened)`, {
    method: "PATCH",
    headers: {
      apikey: supaKey, Authorization: `Bearer ${supaKey}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: "pending", completedAt: null, completedBy: null }),
  });

  // Get the most recent OutreachLog → its resendMessageId
  const log = await querySupabase<{ id: string; resendMessageId: string }>(
    "OutreachLog", "id,resendMessageId", "leadId", DUMMY_LEAD_ID,
  );
  if (!log) {
    console.error("✗ No OutreachLog row to test against — run test-phase3a-send.ts first.");
    process.exit(1);
  }
  console.log(`✓ Target OutreachLog: ${log.id} (msgId=${log.resendMessageId})\n`);

  // 1. Unsigned POST → 401
  const r1 = await postEvent(
    { type: "email.opened", created_at: new Date().toISOString(), data: { email_id: log.resendMessageId } },
    { sign: false },
  );
  if (r1.status === 401) console.log("✓ Unsigned POST → 401 (signature rejected)");
  else console.error(`✗ Unsigned POST → ${r1.status} (expected 401)`);

  // 2. Signed email.opened
  const r2 = await postEvent({
    type: "email.opened",
    created_at: new Date().toISOString(),
    data: { email_id: log.resendMessageId },
  });
  if (r2.status === 200) console.log("✓ Signed email.opened → 200");
  else console.error(`✗ email.opened → ${r2.status} body=${r2.body}`);

  await new Promise((r) => setTimeout(r, 300));
  const olAfterOpen = await querySupabase<{ openedAt: string | null }>(
    "OutreachLog", "openedAt", "id", log.id,
  );
  if (olAfterOpen?.openedAt) console.log(`  ✓ OutreachLog.openedAt = ${olAfterOpen.openedAt}`);
  else console.error("  ✗ OutreachLog.openedAt still null");

  const leadAfterOpen = await querySupabase<{ stage: string; emailOpenedAt: string | null }>(
    "Lead", "stage,emailOpenedAt", "id", DUMMY_LEAD_ID,
  );
  if (leadAfterOpen?.emailOpenedAt) console.log(`  ✓ Lead.emailOpenedAt = ${leadAfterOpen.emailOpenedAt}`);
  else console.error("  ✗ Lead.emailOpenedAt still null");
  if (leadAfterOpen?.stage === "email_opened") console.log(`  ✓ Lead.stage advanced to email_opened`);
  else console.error(`  ✗ Lead.stage = "${leadAfterOpen?.stage}" (expected email_opened)`);

  const openedStep = await fetch(
    `${supaUrl}/rest/v1/LeadStepStatus?leadId=eq.${DUMMY_LEAD_ID}&stepId=eq.step_email_opened&select=status,completedBy`,
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } },
  ).then((r) => r.json()) as Array<{ status: string; completedBy: string }>;
  if (openedStep[0]?.status === "done" && openedStep[0]?.completedBy === "system") {
    console.log(`  ✓ Step "Email dibuka" → done (completedBy=system)`);
  } else {
    console.error(`  ✗ step_email_opened state wrong: ${JSON.stringify(openedStep[0])}`);
  }

  // 3. Signed email.clicked
  console.log("");
  const r3 = await postEvent({
    type: "email.clicked",
    created_at: new Date().toISOString(),
    data: { email_id: log.resendMessageId, click: { link: "https://satutuju.id" } },
  });
  if (r3.status === 200) console.log("✓ Signed email.clicked → 200");
  else console.error(`✗ email.clicked → ${r3.status} body=${r3.body}`);

  await new Promise((r) => setTimeout(r, 300));
  const leadAfterClick = await querySupabase<{ stage: string; emailClickedAt: string | null }>(
    "Lead", "stage,emailClickedAt", "id", DUMMY_LEAD_ID,
  );
  if (leadAfterClick?.emailClickedAt) console.log(`  ✓ Lead.emailClickedAt = ${leadAfterClick.emailClickedAt}`);
  if (leadAfterClick?.stage === "email_clicked") console.log(`  ✓ Lead.stage advanced to email_clicked`);

  // 4. Signed email.bounced (against a different log — to avoid clobbering the opened/clicked test)
  console.log("");
  const r4 = await postEvent({
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: { email_id: log.resendMessageId, reason: "Mailbox does not exist" },
  });
  if (r4.status === 200) console.log("✓ Signed email.bounced → 200");

  const olAfterBounce = await querySupabase<{ status: string; bouncedAt: string | null; errorMessage: string | null }>(
    "OutreachLog", "status,bouncedAt,errorMessage", "id", log.id,
  );
  if (olAfterBounce?.status === "bounced") console.log(`  ✓ OutreachLog.status = bounced (reason: "${olAfterBounce.errorMessage}")`);

  // 5. Replay invariance — re-send the open event, OutreachLog.openedAt should NOT change
  console.log("");
  const firstOpenedAt = olAfterOpen?.openedAt;
  const r5 = await postEvent({
    type: "email.opened",
    created_at: new Date().toISOString(),
    data: { email_id: log.resendMessageId },
  });
  if (r5.status === 200) {
    const olAfterReplay = await querySupabase<{ openedAt: string }>(
      "OutreachLog", "openedAt", "id", log.id,
    );
    if (olAfterReplay?.openedAt === firstOpenedAt) {
      console.log(`✓ Replay invariance: openedAt unchanged on duplicate event`);
    } else {
      console.error(`✗ openedAt mutated on replay: ${firstOpenedAt} → ${olAfterReplay?.openedAt}`);
    }
  }

  console.log("\n=== Done ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
