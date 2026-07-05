-- Phase 20 — Fireflies.ai session recap columns on "Session".
-- Applied to Supabase via MCP apply_migration as "session_fireflies_recap".
-- Populated by the Fireflies webhook (/api/webhooks/fireflies) after a
-- mentoring Google Meet is transcribed. Overview + action items + transcript
-- URL are mentor/admin-facing; shortSummary is the clean recap for the mentee.
ALTER TABLE "Session"
  ADD COLUMN "firefliesTranscriptId"  TEXT,
  ADD COLUMN "firefliesOverview"      TEXT,
  ADD COLUMN "firefliesShortSummary"  TEXT,
  ADD COLUMN "firefliesActionItems"   TEXT,
  ADD COLUMN "firefliesTranscriptUrl" TEXT,
  ADD COLUMN "firefliesRecapAt"       TIMESTAMP(3);
