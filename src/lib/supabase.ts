import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key (for file uploads)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const STORAGE_BUCKET = "documents";

// Private bucket (public=false) for mentee deposit proofs — financial data.
// Files here are only reachable through the authed streaming API
// (/api/mentee-deposit/proof), never via public URLs.
export const DEPOSIT_PROOF_BUCKET = "deposit-proofs";
