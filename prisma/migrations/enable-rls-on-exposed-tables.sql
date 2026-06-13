-- Security hardening — applied to Supabase via MCP apply_migration as
-- "enable_rls_on_exposed_tables".
--
-- The Supabase linter flagged 3 public tables with RLS DISABLED (ERROR
-- level, rls_disabled_in_public): they were reachable through PostgREST
-- with the anon key. Enable RLS with NO policies so anon/authenticated get
-- default-deny — matching the ~35 other tables. The app is unaffected: it
-- reaches the DB only via the service-role key + the direct Postgres
-- connection, both of which bypass RLS.
ALTER TABLE "MenteeContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenteeDeposit"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialPost"     ENABLE ROW LEVEL SECURITY;
