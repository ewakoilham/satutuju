-- Security hardening — applied to Supabase via MCP apply_migration as
-- "drop_broad_storage_listing_policies".
--
-- The linter flagged the public buckets (documents, avatars, mentor-photos)
-- with a broad public SELECT policy on storage.objects
-- (public_bucket_allows_listing): it let the anon/public role LIST and
-- enumerate every file in the bucket via the Storage REST API — including the
-- contract PDFs (PII) under documents/. Public buckets serve objects through
-- the /object/public/ endpoint WITHOUT needing this policy, so dropping it
-- removes enumeration while keeping direct URL access intact (verified: avatar,
-- mentor-photo, and a documents PDF all still return 200 after the drop). The
-- app's own uploads/downloads use the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS "Public read access"             ON storage.objects; -- documents
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects; -- avatars
DROP POLICY IF EXISTS "mentor_photos_public_read"      ON storage.objects; -- mentor-photos
