/** POST /api/sessions/[id]/aigen — STUB (v2).
 *
 *  The AI-assisted draft report feature (Gemini-backed) is deferred. The
 *  Sesi page's manual report paths (paste / Drive / file upload) prefill the
 *  laporan form client-side without hitting this endpoint; only the
 *  "Hasilkan draf laporan" AI-generate path calls here, and we return 501 so
 *  the UI can show a "coming soon" state.
 *
 *  When the feature lands, restore the Gemini summarization implementation
 *  from the v5 branch (src/lib/gemini.ts + @google/generative-ai).
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "AI draft belum tersedia (v2)." }, { status: 501 });
}
