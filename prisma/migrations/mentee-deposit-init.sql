-- Phase 19 — Mentee deposit (Pasal 9 Perjanjian Layanan Mentoring Mentee).
-- Applied to Supabase via MCP apply_migration as "mentee_deposit_init".
-- Lifecycle: no row = NOT_STARTED → UPLOADED (gate opens) → VERIFIED
-- or REJECTED (gate closes; re-upload returns to UPLOADED).
CREATE TABLE "MenteeDeposit" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'UPLOADED',
  "amount"          INTEGER NOT NULL DEFAULT 1000000,
  "proofPath"       TEXT,
  "proofUploadedAt" TIMESTAMP(3),
  "confirmations"   JSONB,
  "transferNote"    TEXT,
  "verifiedAt"      TIMESTAMP(3),
  "verifiedBy"      TEXT,
  "rejectedAt"      TIMESTAMP(3),
  "rejectedReason"  TEXT,
  "rejectionCount"  INTEGER NOT NULL DEFAULT 0,
  "history"         JSONB,
  "ipAddress"       TEXT,
  "userAgent"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenteeDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenteeDeposit_userId_key" ON "MenteeDeposit"("userId");
CREATE INDEX "MenteeDeposit_status_idx" ON "MenteeDeposit"("status");

ALTER TABLE "MenteeDeposit"
  ADD CONSTRAINT "MenteeDeposit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
