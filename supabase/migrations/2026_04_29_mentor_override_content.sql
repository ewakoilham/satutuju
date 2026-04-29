-- Adds editable bio-content columns to MentorOverride.
-- Run once in the Supabase SQL editor (or via your migration runner).
--
-- Why these columns exist:
--   The bio modal previously rendered fields straight from mentors.json.
--   Admins now need to override quote/achievement/studies/s1/scholarship
--   without redeploying the app. Each column is nullable; NULL means
--   "use the JSON fallback".

ALTER TABLE "MentorOverride"
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "achievement" TEXT,
  ADD COLUMN IF NOT EXISTS "currentStudies" TEXT,
  ADD COLUMN IF NOT EXISTS "s1" TEXT,
  ADD COLUMN IF NOT EXISTS "scholarship" TEXT;
