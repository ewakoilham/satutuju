-- ──────────────────────────────────────────────────────────────────────────
-- Consolidated migration: brings DB in sync with current TS code.
--
-- Apply via Supabase Dashboard → SQL Editor in TWO separate runs:
--
--   ┌─ STEP 1 (lines 12-13) ────────────────────────────────────────────────┐
--   │ Paste ONLY the two ALTER TYPE lines. Click Run. Wait for "Success".  │
--   │ This commits the enum extension so subsequent queries can use the    │
--   │ new values.                                                           │
--   └───────────────────────────────────────────────────────────────────────┘

ALTER TYPE "LeadBucket" ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE "LeadBucket" ADD VALUE IF NOT EXISTS 'domestic';

--   ┌─ STEP 2 (everything below) ──────────────────────────────────────────┐
--   │ After step 1 succeeds, paste everything BELOW this block into a new  │
--   │ SQL Editor query and run it. Idempotent / safe to re-run.            │
--   └───────────────────────────────────────────────────────────────────────┘

-- ── Part A: rename email templates (A_B_D → A_B_C, C → D) ────────────────
-- Idempotent: if a previous run already renamed them, these UPDATEs match
-- zero rows and are no-ops.
UPDATE "LeadEmailTemplate"
   SET id = 'tpl_a_b_c', bucket = 'A_B_C'
 WHERE id = 'tpl_a_b_d';

UPDATE "LeadEmailTemplate"
   SET id = 'tpl_d', bucket = 'D'
 WHERE id = 'tpl_c';

-- ── Part B: Lead.bucket values already match new semantics ──────────────
-- Inspection (before running this migration) showed existing C rows have
-- bucketReason "X (partner) → Bucket C" and existing D rows have
-- "no specific campus parsed → Bucket D" — i.e. the sync layer already
-- wrote new-semantics values into Lead.bucket. So no row swap is needed.
-- (The original leads-swap-c-d.sql migration is now historical.)

-- ── Part C: Venzo → Razak in all template bodies ─────────────────────────
UPDATE "LeadEmailTemplate"
   SET body = REPLACE(REPLACE(body,
              'Aku Venzo, salah satu co-founder Satu Tuju.',
              'Aku Razak, salah satu co-founder Satu Tuju.'),
              'Kak Venzo',
              'Kak Razak'),
       "updatedAt" = now()
 WHERE body LIKE '%Venzo%';

-- ── Part D: seed the two new email templates ─────────────────────────────
INSERT INTO "LeadEmailTemplate" (id, bucket, subject, body, version, "updatedAt")
VALUES (
  'tpl_incomplete',
  'incomplete',
  'Halo {{name}}, ada yang terlewat di pendaftaranmu di Satu Tuju',
$$Halo {{name}},

Terima kasih sudah mendaftar di Satu Tuju!

Saat kami review datamu, sepertinya kolom kampus & negara tujuanmu masih kosong. Supaya kami bisa pasangkan kamu dengan mentor yang paling pas, kami butuh info tersebut.

Bisa reply email ini dengan:
  1. Kampus tujuan (atau beberapa pilihan kalau masih explore)
  2. Negara tujuan
  3. Program/jurusan yang kamu minati

Kalau funding plan-mu juga belum yakin ({{fundingPlan}}), tulis saja kondisi terbaru — kami bantu cari opsi yang masuk akal.

Kami tunggu balasannya ya — sampai ketemu di tahap berikutnya!

Salam,
Aku Razak, salah satu co-founder Satu Tuju.

Kak Razak$$,
  1,
  now()
)
ON CONFLICT (bucket) DO NOTHING;

INSERT INTO "LeadEmailTemplate" (id, bucket, subject, body, version, "updatedAt")
VALUES (
  'tpl_domestic',
  'domestic',
  'Halo {{name}}, update soal pendaftaranmu di Satu Tuju',
$$Halo {{name}},

Terima kasih sudah mendaftar di Satu Tuju.

Kami melihat target studimu adalah {{campusJurusan}}, yang ada di Indonesia. Saat ini Satu Tuju fokus membantu mahasiswa Indonesia yang ingin melanjutkan studi S2/S3 ke luar negeri — jadi untuk studi domestik, kami belum bisa bantu.

Tapi kalau di masa depan kamu juga punya rencana studi abroad (baik full scholarship, self-funded, maupun partial), jangan ragu daftar ulang ya. Kami siap bantu kapan pun kamu siap — termasuk diskusi soal funding plan ({{fundingPlan}}) yang paling realistis untuk kondisimu.

Semoga sukses dengan studinya, dan sampai jumpa lagi suatu hari nanti!

Salam,
Aku Razak, salah satu co-founder Satu Tuju.

Kak Razak$$,
  1,
  now()
)
ON CONFLICT (bucket) DO NOTHING;

-- ── Part E: retroactively re-bucket existing unclassified leads ─────────
-- Mirrors src/lib/leads/bucketing.ts heuristics. Keep in sync if those evolve.

-- E1. "incomplete" — empty / placeholder targets
UPDATE "Lead"
   SET bucket = 'incomplete',
       "bucketReason" = 'Target kampus & negara belum diisi di Tally (input: "' || "targetCampusAndProgram" || '")',
       "updatedAt" = now()
 WHERE bucket = 'unclassified'
   AND (
        "targetCampusAndProgram" = ''
        OR "targetCampusAndProgram" ILIKE '%(target tidak diisi)%'
        OR "targetCampusAndProgram" ~ '^[[:space:]\-,.]+$'
   );

-- E2. "domestic" — Indonesian universities or country = Indonesia
UPDATE "Lead"
   SET bucket = 'domestic',
       "parsedCountry" = 'Indonesia',
       "bucketReason" = 'Target di Indonesia (input: "' || "targetCampusAndProgram" || '") — Satu Tuju fokus studi ke luar negeri',
       "updatedAt" = now()
 WHERE bucket = 'unclassified'
   AND (
        "targetCampusAndProgram" ~* '\yindonesia\y'
     OR "targetCampusAndProgram" ~* '\yuniversitas\y'
     OR "targetCampusAndProgram" ~* '\y(itb|ugm|its|ipb|unair|unpad|unsri|unhas|undip|uin|unesa|usu)\y'
     OR lower(trim("targetCampusAndProgram")) = 'id'
   );

-- ──────────────────────────────────────────────────────────────────────────
-- Verify (run these after step 2 finishes — counts should reflect the
-- new bucket distribution; templates should be A_B_C / D / incomplete /
-- domestic with Razak signatures):
--
--   SELECT bucket, count(*) FROM "Lead" GROUP BY bucket ORDER BY bucket;
--   SELECT id, bucket, substring(subject, 1, 80) FROM "LeadEmailTemplate" ORDER BY bucket;
--   SELECT id, substring(body, 1, 120) FROM "LeadEmailTemplate" WHERE body LIKE '%Venzo%';  -- should return 0 rows
--
-- AFTER this migration succeeds, click "Sync from Tally" in the admin
-- panel. That will pick up the new COUNTRY_KEYWORDS expansions (Qatar,
-- Hungary, China, Russia, Colombia, Europe, Italy) + parsing fixes
-- (Manchester reversed order, Southampton, Ferrara, Cambradge typo) for
-- the remaining ~10 leads still in unclassified.
-- ──────────────────────────────────────────────────────────────────────────
