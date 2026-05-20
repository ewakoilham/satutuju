-- ──────────────────────────────────────────────────────────────────────────
-- Phase 1 — Leads pipeline migration
--
-- Apply via Supabase Dashboard → SQL Editor → New query → paste this file →
-- Run. Safe to re-run: each CREATE uses IF NOT EXISTS or a DO block guard.
--
-- This file is the SQL equivalent of the Prisma models appended to
-- prisma/schema.prisma. If schema.prisma evolves, regenerate.
-- ──────────────────────────────────────────────────────────────────────────

-- ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "LeadBucket" AS ENUM ('A', 'B', 'C', 'D', 'unclassified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM (
    'new',
    'outreach_sent',
    'email_opened',
    'email_clicked',
    'call_scheduled',
    'call_completed',
    'deposit_pending',
    'deposit_paid',
    'matched',
    'declined',
    'waitlist',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Lead" (
  "id"                      TEXT PRIMARY KEY,
  "name"                    TEXT NOT NULL,
  "email"                   TEXT NOT NULL,
  "whatsappNumber"          TEXT,
  "targetCampusAndProgram"  TEXT NOT NULL,
  "fundingPlan"             TEXT NOT NULL,
  "submittedAt"             TIMESTAMP(3) NOT NULL DEFAULT now(),
  "tallySubmissionId"       TEXT UNIQUE,
  "bucket"                  "LeadBucket" NOT NULL DEFAULT 'unclassified',
  "bucketReason"            TEXT,
  "parsedCountry"           TEXT,
  "parsedCampus"            TEXT,
  "parsedField"             TEXT,
  "isCampusPartner"         BOOLEAN,
  "hasCountryMentor"        BOOLEAN NOT NULL DEFAULT false,
  "stage"                   "LeadStage" NOT NULL DEFAULT 'new',
  "outreachSentAt"          TIMESTAMP(3),
  "emailOpenedAt"           TIMESTAMP(3),
  "emailClickedAt"          TIMESTAMP(3),
  "callScheduledAt"         TIMESTAMP(3),
  "callCompletedAt"         TIMESTAMP(3),
  "assignedInterviewer"     TEXT,
  "depositTier"             INTEGER,
  "readinessScore"          INTEGER,
  "callNotes"               TEXT,
  "redFlags"                TEXT,
  "decision"                TEXT,
  "mentorMatchedId"         TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Lead_bucket_idx"        ON "Lead"("bucket");
CREATE INDEX IF NOT EXISTS "Lead_stage_idx"         ON "Lead"("stage");
CREATE INDEX IF NOT EXISTS "Lead_parsedCountry_idx" ON "Lead"("parsedCountry");
CREATE INDEX IF NOT EXISTS "Lead_submittedAt_idx"   ON "Lead"("submittedAt");
CREATE INDEX IF NOT EXISTS "Lead_email_idx"         ON "Lead"("email");

CREATE TABLE IF NOT EXISTS "LeadStageHistory" (
  "id"        TEXT PRIMARY KEY,
  "leadId"    TEXT NOT NULL,
  "fromStage" TEXT,
  "toStage"   TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "LeadStageHistory_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "LeadStageHistory_leadId_createdAt_idx"
  ON "LeadStageHistory"("leadId", "createdAt");

CREATE TABLE IF NOT EXISTS "OutreachLog" (
  "id"              TEXT PRIMARY KEY,
  "leadId"          TEXT NOT NULL,
  "channel"         TEXT NOT NULL DEFAULT 'email',
  "templateUsed"    TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "sentAt"          TIMESTAMP(3) NOT NULL DEFAULT now(),
  "status"          TEXT NOT NULL DEFAULT 'sent',
  "resendMessageId" TEXT UNIQUE,
  "openedAt"        TIMESTAMP(3),
  "clickedAt"       TIMESTAMP(3),
  "bouncedAt"       TIMESTAMP(3),
  "errorMessage"    TEXT,
  CONSTRAINT "OutreachLog_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "OutreachLog_leadId_idx"          ON "OutreachLog"("leadId");
CREATE INDEX IF NOT EXISTS "OutreachLog_resendMessageId_idx" ON "OutreachLog"("resendMessageId");

CREATE TABLE IF NOT EXISTS "LeadStepDefinition" (
  "id"          TEXT PRIMARY KEY,
  "order"       INTEGER NOT NULL,
  "label"       TEXT NOT NULL,
  "description" TEXT,
  "autoTrigger" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "LeadStepDefinition_order_idx"    ON "LeadStepDefinition"("order");
CREATE INDEX IF NOT EXISTS "LeadStepDefinition_isActive_idx" ON "LeadStepDefinition"("isActive");

CREATE TABLE IF NOT EXISTS "LeadStepStatus" (
  "id"          TEXT PRIMARY KEY,
  "leadId"      TEXT NOT NULL,
  "stepId"      TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "LeadStepStatus_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE,
  CONSTRAINT "LeadStepStatus_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "LeadStepDefinition"("id") ON DELETE CASCADE,
  CONSTRAINT "LeadStepStatus_leadId_stepId_key"
    UNIQUE ("leadId", "stepId")
);

CREATE INDEX IF NOT EXISTS "LeadStepStatus_leadId_idx" ON "LeadStepStatus"("leadId");
CREATE INDEX IF NOT EXISTS "LeadStepStatus_status_idx" ON "LeadStepStatus"("status");

CREATE TABLE IF NOT EXISTS "LeadEmailTemplate" (
  "id"        TEXT PRIMARY KEY,
  "bucket"    TEXT NOT NULL UNIQUE,
  "subject"   TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "version"   INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "LeadAutoSendSetting" (
  "id"           TEXT PRIMARY KEY DEFAULT 'singleton',
  "enabled"      BOOLEAN NOT NULL DEFAULT false,
  "delayMinutes" INTEGER NOT NULL DEFAULT 60,
  "lastRunAt"    TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedBy"    TEXT
);

-- SEED DATA ────────────────────────────────────────────────────────────────
-- Idempotent: ON CONFLICT DO NOTHING so re-running this file is safe.

-- 6 default pipeline steps
INSERT INTO "LeadStepDefinition" ("id", "order", "label", "description", "autoTrigger", "isActive")
VALUES
  ('step_classify',      1, 'Klasifikasi otomatis',          'Lead masuk dan bucket di-assign oleh sistem',                          NULL,             true),
  ('step_review_bucket', 2, 'Review bucket & override jika perlu', 'Admin verifikasi bucket otomatis, override + justifikasi kalau salah', NULL,             true),
  ('step_email_sent',    3, 'Kirim email pertama',           'Outreach email terkirim ke lead',                                       'email_sent',     true),
  ('step_email_opened',  4, 'Email dibuka',                  'Lead membuka email — auto-tracked oleh Resend webhook',                'email_opened',   true),
  ('step_schedule_call', 5, 'Schedule initial call',         'Admin set jadwal call 15 menit',                                        NULL,             true),
  ('step_match_mentor',  6, 'Match dengan mentor',           'Mentor di-assign ke lead — auto-completed saat matched',               'matched',        true)
ON CONFLICT ("id") DO NOTHING;

-- Default email templates (subject + body finalised by user)
INSERT INTO "LeadEmailTemplate" ("id", "bucket", "subject", "body", "version")
VALUES
  (
    'tpl_a_b_c',
    'A_B_C',
    'Kak {{name}}, kamu lolos ke tahap berikutnya di Satu Tuju 🎯',
    'Halo Kak {{name}}! 👋

Aku Razak, salah satu co-founder Satu Tuju.

Aku udah review profil Kakak — rencana lanjut ke {{campusJurusan}} dengan jalur {{fundingPlan}} — dan aku seneng banget bisa bilang bahwa Kakak terpilih untuk lanjut ke tahap berikutnya.

Dari sekian banyak pendaftar, kami lihat Kakak punya potensi yang besar untuk berhasil. Karena itu, aku mau ngajak Kakak untuk sesi eksklusif 15 menit bareng aku via Zoom/Google Meet — khusus buat ngebahas lebih dalam gimana Satu Tuju bisa bantu perjalanan Kakak.

Silakan pilih slot-mu di sini:
👉 https://calendar.app.google/oZQo2ARi41aeeczy6

Slot sangat terbatas. Kalau ada pertanyaan sebelum itu, reply aja langsung ke email ini ya Kak.

Sampai ketemu,
Kak Razak
Co-founder, Satu Tuju
www.satutuju.id',
    1
  ),
  (
    'tpl_d',
    'D',
    'Update penting soal pendaftaran kamu di Satu Tuju',
    'Halo Kak {{name}}! 👋

Aku Razak, salah satu co-founder Satu Tuju.

Makasih banget udah daftar dan percaya sama program kami. Aku personally udah review profil Kakak — rencana lanjut ke {{campusJurusan}} dengan jalur {{fundingPlan}} — dan aku mau jujur dari awal.

Saat ini, mentor kami tersedia untuk kampus-kampus di:
- 🇦🇺 Australia
- 🇬🇧 United Kingdom
- 🇳🇿 New Zealand
- 🇳🇱 Netherlands

Selain itu, program kami hanya bisa memproses pendaftaran ke kampus-kampus yang masuk dalam jaringan partner kami — yang mencakup 3.000+ universitas di negara-negara di atas.

Karena tujuan Kakak saat ini berada di luar cakupan tersebut, kami belum bisa proceed untuk matching mentor.

Tapi kalau Kakak terbuka untuk mengeksplorasi opsi di negara dan kampus yang kami cover, kami dengan senang hati bantu dari sana. Banyak kampus top di negara-negara tersebut yang sangat relevan dengan bidang {{campusJurusan}} yang Kakak minati.

Kalau Kakak tertarik untuk tahu lebih lanjut atau mau diskusi opsi yang ada, reply aja langsung ke email ini. Kami tunggu kabar dari Kakak.

Salam,
Kak Razak
Co-founder, Satu Tuju
www.satutuju.id',
    1
  )
ON CONFLICT ("bucket") DO NOTHING;

-- Auto-send singleton row (starts disabled)
INSERT INTO "LeadAutoSendSetting" ("id", "enabled", "delayMinutes")
VALUES ('singleton', false, 60)
ON CONFLICT ("id") DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   SELECT count(*) FROM "LeadStepDefinition";        -- expect 6
--   SELECT count(*) FROM "LeadEmailTemplate";         -- expect 2
--   SELECT count(*) FROM "LeadAutoSendSetting";       -- expect 1
--   SELECT * FROM "Lead" LIMIT 1;                     -- expect 0 rows (empty table OK)
-- ──────────────────────────────────────────────────────────────────────────
