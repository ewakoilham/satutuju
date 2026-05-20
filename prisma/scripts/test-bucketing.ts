/**
 * Smoke-test the leads bucketing logic against representative inputs.
 *
 *   npx tsx prisma/scripts/test-bucketing.ts
 *
 * Does not touch the DB. Reads the static mentor seed
 * (`src/lib/mentors.ts`) so the cross-reference step matches the runtime
 * behavior of `classifyLead()`.
 */

import { classifyLead } from "@/lib/leads/bucketing";
import { MENTORS } from "@/lib/mentors";

interface TestCase {
  input: string;
  expectedBucket: string;
  expectedField?: string;
  notes?: string;
}

const CASES: TestCase[] = [
  // ── A: mentor available + partner campus ───────────────────────────────
  { input: "Master of Business at Monash University",            expectedBucket: "A", expectedField: "Business" },
  { input: "MSc Computer Science at Imperial College London",    expectedBucket: "A", expectedField: "STEM" },
  { input: "Master of Engineering at TU Delft",                  expectedBucket: "A", expectedField: "STEM" },
  { input: "Master of Energy at University of Auckland",         expectedBucket: "A", expectedField: "STEM" },

  // ── C: no mentor but partner campus ────────────────────────────────────
  { input: "MBA at Harvard Business School",                     expectedBucket: "C", expectedField: "Business" },
  { input: "PhD in Machine Learning at MIT",                     expectedBucket: "C", expectedField: "STEM" },
  { input: "Master in Public Policy at NUS Singapore",           expectedBucket: "C", expectedField: "Business", notes: "Public Policy treated as Business; NUS is partner; no Singapore mentor → C" },

  // ── D: country known but no specific campus + no mentor ──────────────
  { input: "Master of Engineering di Korea Selatan",             expectedBucket: "D", expectedField: "STEM", notes: "South Korea: no specific campus in alias list + no mentor → D (isCampusPartner=null)" },
  { input: "MSc Data Science di Jerman",                         expectedBucket: "D", expectedField: "STEM", notes: "Germany: no campus in input + no mentor → D" },

  // ── Unclassified: country unclear ──────────────────────────────────────
  { input: "S2 di kampus top luar negeri",                       expectedBucket: "unclassified", notes: "no country keyword" },
  { input: "Magister di luar",                                   expectedBucket: "unclassified", notes: "too vague" },

  // ── incomplete: target field blank or pure placeholder ────────────────
  { input: "",                                                   expectedBucket: "incomplete", notes: "empty string" },
  { input: "(target tidak diisi)",                               expectedBucket: "incomplete", notes: "sync-layer sentinel" },
  { input: "-",                                                  expectedBucket: "incomplete", notes: "dash placeholder" },
  { input: "-, -",                                               expectedBucket: "incomplete", notes: "comma-separated dashes" },

  // ── domestic: target in Indonesia ──────────────────────────────────────
  { input: "Indonesia",                                          expectedBucket: "domestic", notes: "bare country" },
  { input: "ID",                                                 expectedBucket: "domestic", notes: "ISO-2 country code" },
  { input: "Universitas Indonesia, Indonesia",                   expectedBucket: "domestic", notes: "UI domestic" },
  { input: "Universitas Negeri Surabaya, Indonesia",             expectedBucket: "domestic", notes: "Indonesian uni name" },
  { input: "universitas nasional, jakarta",                      expectedBucket: "domestic", notes: "lowercase + city" },

  // ── Domestic guard: foreign campus mentioned + word "Indonesia" → NOT domestic ──
  { input: "University of Ferrara, Indonesia",                   expectedBucket: "D", notes: "Ferrara → Italy resolves first; Italy has no mentor+partner → D" },

  // ── Expanded country keywords → bucket D (no mentor, no partner) ──────
  { input: "qatar university, qatar",                            expectedBucket: "D", notes: "Qatar, no mentor coverage" },
  { input: "Szeged university, Hungaria",                        expectedBucket: "D", notes: "Hungary keyword" },
  { input: "Tsinghua University, China",                         expectedBucket: "D", notes: "China keyword" },
  { input: "Zhejiang, China",                                    expectedBucket: "D", notes: "China keyword" },
  { input: "Tomsk politeknik, Rusia",                            expectedBucket: "D", notes: "Russia (Bahasa: Rusia)" },
  { input: "Colombia",                                           expectedBucket: "D", notes: "Colombia keyword" },
  { input: "Europe",                                             expectedBucket: "D", notes: "Vague region treated as no-coverage" },

  // ── Parsing fixes ──────────────────────────────────────────────────────
  { input: "ULC, Cambradge",                                     expectedBucket: "A", notes: "Cambridge typo → UK (mentor available) + Cambridge partner → A" },
  { input: "University of Southampton, MSc Accounting",          expectedBucket: "A", notes: "Southampton newly added → UK partner + UK mentor → A" },
  { input: "Engineering Project Management, Manchester University", expectedBucket: "A", notes: "Reversed word order accepted; Manchester partner + UK mentor → A" },
];

function main() {
  console.log("\n=== classifyLead() smoke test ===");
  console.log(`Static seed mentors: ${MENTORS.length}`);
  console.log(`Distinct mentor countries: ${[...new Set(MENTORS.map((m) => m.country).filter(Boolean))].join(", ")}\n`);

  let pass = 0;
  let fail = 0;

  for (const tc of CASES) {
    const result = classifyLead(tc.input, MENTORS);
    const ok = result.bucket === tc.expectedBucket
      && (tc.expectedField === undefined || result.parsedField === tc.expectedField);
    const tag = ok ? "  ✓" : "  ✗";
    console.log(`${tag} [${result.bucket.padEnd(13)}] "${tc.input}"`);
    console.log(`     → country=${result.parsedCountry ?? "-"}, campus=${result.parsedCampus ?? "-"}, field=${result.parsedField}, mentor=${result.hasCountryMentor}, partner=${result.isCampusPartner}`);
    console.log(`     reason: ${result.reason}`);
    if (tc.notes) console.log(`     note: ${tc.notes}`);
    if (!ok) {
      console.log(`     EXPECTED bucket=${tc.expectedBucket}${tc.expectedField ? `, field=${tc.expectedField}` : ""}`);
      fail++;
    } else {
      pass++;
    }
    console.log();
  }

  console.log(`=== Summary: ${pass} pass, ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}

main();
