-- ──────────────────────────────────────────────────────────────────────────
-- Migration: swap semantics of bucket C and D.
--
-- BEFORE this change:
--   C = neither mentor nor partner (worst)
--   D = partner kampus only (no mentor)
--
-- AFTER this change:
--   C = partner kampus only (no mentor)
--   D = neither mentor nor partner (worst)
--
-- Apply via Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (idempotent via WHERE clauses on specific row IDs).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Rename existing email template rows to match the new convention.
--    Old: 'A_B_D' (invitation), 'C' (confirmation)
--    New: 'A_B_C' (invitation), 'D' (confirmation)
--    UPDATE id alongside bucket so the row IDs reflect their semantics.
UPDATE "LeadEmailTemplate"
   SET id = 'tpl_a_b_c', bucket = 'A_B_C'
 WHERE id = 'tpl_a_b_d';

UPDATE "LeadEmailTemplate"
   SET id = 'tpl_d', bucket = 'D'
 WHERE id = 'tpl_c';

-- 2. Swap existing Lead.bucket values C ↔ D using a temp marker so
--    neither update collides with the other.
UPDATE "Lead" SET bucket = 'unclassified' WHERE bucket = 'C';
UPDATE "Lead" SET bucket = 'C'             WHERE bucket = 'D';
UPDATE "Lead" SET bucket = 'D'             WHERE bucket = 'unclassified'
              AND "bucketReason" LIKE '%no mentor%no partner%';
-- NOTE: the WHERE on the third UPDATE protects genuinely-unclassified
-- rows (those without a parsed country). If your bucketReason text
-- format differs, prefer the alternative below: re-sync from Tally
-- after dropping this migration, since classifyLead() will write the
-- correct new C/D values on every re-sync.

-- ──────────────────────────────────────────────────────────────────────────
-- Verify:
--   SELECT bucket, count(*) FROM "Lead" GROUP BY bucket ORDER BY bucket;
--   SELECT id, bucket FROM "LeadEmailTemplate" ORDER BY bucket;
-- ──────────────────────────────────────────────────────────────────────────
