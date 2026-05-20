/**
 * Phase 3d smoke test — exercises POST /api/new-leads/bulk-outreach
 * with admin auth + verifies aggregate response shape.
 *
 *   npx tsx prisma/scripts/test-phase3d-bulk.ts
 *
 * Uses the two dummy leads:
 *   - ld_test_phase3a_dummy01 (bucket=A → template A_B_C)
 *   - ld_test_phase3d_dummy02 (bucket=D → template D)
 *
 * Assertions:
 *   1. Unauthenticated POST → 401
 *   2. Authenticated POST with 2 leadIds → 200, both sent
 *   3. Authenticated POST with empty array → 400
 *   4. Confirm both OutreachLog rows + stage advances
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env" });

import { SignJWT } from "jose";

const DEV_URL = "http://localhost:3100/api/new-leads/bulk-outreach";
const DUMMY_A = "ld_test_phase3a_dummy01";
const DUMMY_D = "ld_test_phase3d_dummy02";

async function makeAdminCookie(): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "satutuju-dev-secret",
  );
  const token = await new SignJWT({
    userId: "admin1",
    email: "admin@satutuju.id",
    role: "admin",
    name: "Admin SatuTuju",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return `token=${token}`;
}

async function querySupabase<T>(table: string, columns: string, filters: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filters}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  return (await res.json()) as T[];
}

async function main() {
  console.log("\n=== Phase 3d bulk-outreach smoke test ===\n");

  const cookie = await makeAdminCookie();

  // 1. Unauthenticated → 401
  const r1 = await fetch(DEV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadIds: [DUMMY_A] }),
  });
  if (r1.status === 401) console.log("✓ Unauthenticated → 401");
  else console.error(`✗ Unauthenticated → ${r1.status}`);

  // 2. Empty array → 400
  const r2 = await fetch(DEV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ leadIds: [] }),
  });
  if (r2.status === 400) console.log("✓ Empty leadIds → 400");
  else console.error(`✗ Empty leadIds → ${r2.status}`);

  // 3. Bulk send to both dummies
  console.log(`\nSending bulk to [${DUMMY_A}, ${DUMMY_D}]...`);
  const r3 = await fetch(DEV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ leadIds: [DUMMY_A, DUMMY_D] }),
  });
  const body = (await r3.json()) as {
    total: number; sent: number; failed: number; skipped: number;
    results: Array<{ leadId: string; status: string; templateUsed?: string; error?: string }>;
  };
  if (r3.status !== 200) {
    console.error(`✗ Bulk send → ${r3.status} body=${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.log(`✓ Bulk POST → 200`);
  console.log(`  ✓ total=${body.total}, sent=${body.sent}, failed=${body.failed}, skipped=${body.skipped}`);
  for (const r of body.results) {
    const tag = r.status === "sent" ? "    ✓" : r.status === "skipped" ? "    ⤵" : "    ✗";
    console.log(`${tag} ${r.leadId}: ${r.status}${r.templateUsed ? ` (template=${r.templateUsed})` : ""}${r.error ? ` — ${r.error}` : ""}`);
  }

  // 4. Verify side-effects on each lead
  console.log("\n--- side-effect verification ---");
  for (const id of [DUMMY_A, DUMMY_D]) {
    const leads = await querySupabase<{ stage: string; outreachSentAt: string | null }>(
      "Lead", "stage,outreachSentAt", `id=eq.${id}`,
    );
    if (leads[0]?.stage === "outreach_sent" && leads[0]?.outreachSentAt) {
      console.log(`  ✓ ${id}: stage=outreach_sent`);
    } else {
      console.error(`  ✗ ${id}: stage=${leads[0]?.stage}`);
    }

    const logs = await querySupabase<{ id: string; status: string; templateUsed: string }>(
      "OutreachLog", "id,status,templateUsed",
      `leadId=eq.${id}&order=sentAt.desc&limit=1`,
    );
    if (logs[0]?.status === "sent") {
      console.log(`     ✓ OutreachLog: ${logs[0].templateUsed} (status=sent)`);
    } else {
      console.error(`     ✗ OutreachLog: ${JSON.stringify(logs[0])}`);
    }
  }

  console.log("\n=== Done — check inbox at venzo.zufar@satutuju.id (2 emails expected) ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
