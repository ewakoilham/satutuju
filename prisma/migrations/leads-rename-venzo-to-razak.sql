-- ──────────────────────────────────────────────────────────────────────────
-- Migration: switch outreach sender from Venzo to Razak.
--
-- Razak handles all lead outreach going forward. Both email templates
-- (invitation A/B/C + confirmation D) need:
--   - "Aku Venzo, salah satu co-founder…" → "Aku Razak, …"
--   - "Kak Venzo" signature                → "Kak Razak"
--
-- Apply via Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (REPLACE is idempotent on the same source string).
-- ──────────────────────────────────────────────────────────────────────────

UPDATE "LeadEmailTemplate"
   SET body = REPLACE(REPLACE(body,
              'Aku Venzo, salah satu co-founder Satu Tuju.',
              'Aku Razak, salah satu co-founder Satu Tuju.'),
              'Kak Venzo',
              'Kak Razak'),
       "updatedAt" = now()
 WHERE body LIKE '%Venzo%';

-- ──────────────────────────────────────────────────────────────────────────
-- Verify (should return 0 rows):
--   SELECT id, bucket FROM "LeadEmailTemplate" WHERE body LIKE '%Venzo%';
-- Sanity check (should show "Aku Razak…" + "Kak Razak"):
--   SELECT id, bucket, substring(body, 1, 120) FROM "LeadEmailTemplate";
-- ──────────────────────────────────────────────────────────────────────────
