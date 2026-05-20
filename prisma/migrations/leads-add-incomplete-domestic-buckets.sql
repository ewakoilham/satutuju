-- ──────────────────────────────────────────────────────────────────────────
-- Migration: add two new LeadBucket values + matching email templates.
--
-- WHY: when we surveyed the unclassified pile, two distinct populations
-- emerged that neither A/B/C/D handles cleanly:
--
--   1. "incomplete"  — applicant left Tally's "university + country" field
--                      blank. Today these stall in unclassified forever.
--                      They need a re-engagement email asking them to
--                      complete the form, not the regular A_B_C invite.
--
--   2. "domestic"    — applicant wrote an Indonesian university (or just
--                      "Indonesia"). Satu Tuju only supports study
--                      abroad, so these need a polite decline + an open
--                      door for if they later plan to study overseas.
--
-- Apply via Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (ALTER TYPE … IF NOT EXISTS, INSERT … ON CONFLICT).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Extend the LeadBucket enum.
ALTER TYPE "LeadBucket" ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE "LeadBucket" ADD VALUE IF NOT EXISTS 'domestic';

-- Note: in Postgres, an ALTER TYPE ... ADD VALUE must be committed before
-- subsequent queries can USE that new value. If you're running the
-- whole script in one session, run the two ALTER TYPE statements above
-- first as their own transaction, then run the rest.

-- 2. Seed the two new email templates.
--    Both follow the same {{name}} / {{campusJurusan}} / {{fundingPlan}}
--    token convention as the existing A_B_C + D templates. Razak is the
--    outreach voice (signature "Kak Razak").

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

-- 3. Retroactively re-bucket existing unclassified leads.
--    The new bucketing.ts logic will do this on next sync, but admins
--    can also opt into running the SQL below to fix the historical
--    pile without waiting for Tally re-poll.
--
--    Heuristics MIRROR src/lib/leads/bucketing.ts. Keep in sync if the
--    helpers there evolve.

-- 3a. "incomplete" — empty/placeholder targets.
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

-- 3b. "domestic" — Indonesian universities or country = Indonesia.
--      Order matters: this runs AFTER step 3a so empty-target rows
--      become "incomplete" rather than "domestic".
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
-- Verify:
--   SELECT bucket, count(*) FROM "Lead" GROUP BY bucket ORDER BY bucket;
--   SELECT id, bucket, substring(subject, 1, 80) FROM "LeadEmailTemplate";
--
-- Remaining unclassified leads after this migration are the ones where
-- the country is parseable but isn't in COUNTRY_KEYWORDS yet — re-run
-- the Tally sync to apply the new keyword expansions (Qatar, Hungary,
-- China, Russia, Colombia, Europe, Italy) which the TS layer just
-- learned about.
-- ──────────────────────────────────────────────────────────────────────────
