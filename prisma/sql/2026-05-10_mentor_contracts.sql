-- Migration: Mentor Partnership Contract
-- Date: 2026-05-10
-- Adds identity fields to MentorProfile for the Perjanjian Kemitraan Mentor
-- signing flow, and a new MentorContract table to hold one contract per
-- mentor with a frozen identity snapshot, drawn signature, audit trail
-- (IP/UA/hash), and PDF storage path.
--
-- Apply this either via the Supabase SQL editor, or by running
--   npx prisma db push
-- after pulling schema.prisma. Both paths are idempotent thanks to the
-- IF NOT EXISTS guards.

-- ─── MentorProfile: identity fields ───────────────────────────────────────
ALTER TABLE "MentorProfile"
  ADD COLUMN IF NOT EXISTS "placeOfBirth" TEXT,
  ADD COLUMN IF NOT EXISTS "dateOfBirth"  TEXT,
  ADD COLUMN IF NOT EXISTS "idType"       TEXT,
  ADD COLUMN IF NOT EXISTS "idNumber"     TEXT,
  ADD COLUMN IF NOT EXISTS "npwp"         TEXT,
  ADD COLUMN IF NOT EXISTS "legalAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber"  TEXT;

-- ─── MentorContract: one contract per mentor ──────────────────────────────
CREATE TABLE IF NOT EXISTS "MentorContract" (
  "id"               TEXT      NOT NULL,
  "userId"           TEXT      NOT NULL,
  "contractNumber"   TEXT      NOT NULL,
  "status"           TEXT      NOT NULL,
  "templateVersion"  TEXT      NOT NULL,
  "identitySnapshot" JSONB,
  "signatureDataUrl" TEXT,
  "signedAt"         TIMESTAMP(3),
  "signatureHash"    TEXT,
  "ipAddress"        TEXT,
  "userAgent"        TEXT,
  "pdfPath"          TEXT,
  "voidedAt"         TIMESTAMP(3),
  "voidReason"       TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MentorContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MentorContract_userId_key"
  ON "MentorContract"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "MentorContract_contractNumber_key"
  ON "MentorContract"("contractNumber");

DO $$ BEGIN
  ALTER TABLE "MentorContract"
    ADD CONSTRAINT "MentorContract_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists; safe to ignore
  NULL;
END $$;
