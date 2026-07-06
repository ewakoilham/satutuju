import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;

/**
 * Load a pairing with everything the dashboard pages need: mentor, mentee,
 * sessions, tasks, progress notes, documents (across all of the mentee's
 * pairings), and live mentee profile.
 *
 * Queries run in parallel "waves" to cut round-trips — previously these were
 * ~5 sequential Supabase calls, which dominated tab-switch latency. Returns the
 * pairing object (shaped exactly like the old /api/pairings/[id] response) or
 * null if it doesn't exist.
 */
export async function getPairingDetail(pairingId: string): Promise<Row | null> {
  // Wave 1 — the pairing (+joins) and this pairing's documents both key only on
  // the pairing id, so fetch them together.
  const [pairingRes, docsRes] = await Promise.all([
    supabase
      .from("Pairing")
      .select(
        "*, mentor:User!mentorId(id, name, email, avatar), mentee:User!menteeId(id, name, email, avatar), sessions:Session(*), tasks:Task(*), progressNotes:ProgressNote(*)"
      )
      .eq("id", pairingId)
      .single(),
    supabase.from("Document").select("*").eq("pairingId", pairingId).order("createdAt", { ascending: false }),
  ]);

  const pairing = pairingRes.data as Row | null;
  if (pairingRes.error || !pairing) return null;

  // Sort nested arrays (same ordering the pages expect).
  if (Array.isArray(pairing.sessions)) {
    (pairing.sessions as Row[]).sort((a, b) => (a.sessionNum as number) - (b.sessionNum as number));
  }
  for (const key of ["tasks", "progressNotes"] as const) {
    if (Array.isArray(pairing[key])) {
      (pairing[key] as Row[]).sort(
        (a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
      );
    }
  }

  const menteeId = pairing.menteeId as string;

  // Wave 2 — the mentee's other pairings (for cross-pairing docs) and their
  // profile both key on menteeId.
  const [otherPairingsRes, menteeProfileRes] = await Promise.all([
    supabase.from("Pairing").select("id").eq("menteeId", menteeId).neq("id", pairingId),
    supabase
      .from("MenteeProfile")
      .select("fullLegalName, intendedStudyProgram, preferredDestinations")
      .eq("userId", menteeId)
      .single(),
  ]);

  let documents = (docsRes.data as Row[]) || [];
  const otherPairingIds = (otherPairingsRes.data || []).map((p: { id: string }) => p.id);
  if (otherPairingIds.length > 0) {
    const { data: otherDocs } = await supabase
      .from("Document")
      .select("*")
      .in("pairingId", otherPairingIds)
      .order("createdAt", { ascending: false });
    if (otherDocs && otherDocs.length > 0) {
      documents = [...documents, ...(otherDocs as Row[])].sort(
        (a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
      );
    }
  }

  pairing.documents = documents;
  pairing.menteeProfile = menteeProfileRes.data || null;
  return pairing;
}
