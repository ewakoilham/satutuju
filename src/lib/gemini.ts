/** Gemini wrapper — used by the Sesi "Hasilkan draf laporan" button.
 *
 *  All calls go through `summarizeSession`, which takes raw text (pasted from
 *  a Meet transcript, a Drive doc body the caller already extracted, or any
 *  prose) and returns a structured draft for the mentor's session report.
 *
 *  Gemini Flash is plenty for this task: cheap, fast, generous free tier.
 *  Switch to Pro by setting `GEMINI_MODEL=gemini-1.5-pro` in `.env`.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiNotConfigured extends Error {
  constructor() {
    super("GEMINI_API_KEY not set in .env");
    this.name = "GeminiNotConfigured";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiNotConfigured();
  return new GoogleGenerativeAI(key);
}

/* Default to the current free-tier Flash model. Override with GEMINI_MODEL in
 * .env if you want Pro (`gemini-2.5-pro`) or want to pin to a specific dated
 * snapshot. Available models change occasionally — check
 * https://ai.google.dev/gemini-api/docs/models if you hit 404s here. */
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface SessionDraft {
  topic: string;
  summary: string;
  obstacles: string;
  /** Privat — mentor sees this but mentee never does. Useful pattern coaching. */
  mentorNotes: string;
  /** 1..5 best-guess from the transcript tone. null when too ambiguous. */
  menteeEnergy: number | null;
}

interface SummarizeOptions {
  /** Free-form prose: Meet transcript, pasted note, doc body, anything. */
  text: string;
  /** Curriculum phase (`discovery`, `planning`, etc) — primes the model. */
  phase?: string;
  /** Session ordinal — anchors the draft. */
  sessionNum?: number;
  /** Mentee name — helps Gemini write in second person when relevant. */
  menteeName?: string;
}

/** Prompt is in Bahasa Indonesia because the platform is Indonesian and the
 *  resulting draft goes into Indonesian-language input fields. We constrain
 *  Gemini to JSON so we don't have to parse free-form Markdown. */
function buildPrompt({ text, phase, sessionNum, menteeName }: SummarizeOptions): string {
  const phaseLabel: Record<string, string> = {
    discovery: "Discovery (eksplorasi minat & motivasi)",
    planning: "Planning (susun strategi aplikasi)",
    writing: "Writing (essay & dokumen)",
    execution: "Execution (submission & beasiswa)",
    closing: "Closing (decision & handoff)",
  };

  const context = [
    sessionNum ? `Sesi ke-${sessionNum}.` : null,
    phase ? `Fase kurikulum: ${phaseLabel[phase] ?? phase}.` : null,
    menteeName ? `Mentee bernama ${menteeName}.` : null,
  ].filter(Boolean).join(" ");

  return `Kamu adalah asisten mentor di program mentoring beasiswa Satu Tuju.
Tugas: bantu mentor mengubah catatan mentah (transkrip Meet, paste-an dokumen,
atau tulisan singkat) jadi draf laporan sesi yang rapi tapi tetap dalam suara
mentor. Bahasa: Indonesia, gaya kasual-profesional (sapaan "kamu", bukan
"Anda"). Jangan mengarang fakta — kalau info tidak ada di teks, biarkan kosong.

${context}

CATATAN MENTAH:
"""
${text.slice(0, 24_000)}
"""

Balas HANYA dengan JSON valid sesuai skema berikut, tanpa markdown fence,
tanpa komentar:
{
  "topic": "satu kalimat singkat: fokus utama sesi (max 80 karakter)",
  "summary": "ringkasan sesi 3-5 kalimat, mengandung apa yang dibahas + kesimpulan kunci",
  "obstacles": "hambatan / kekhawatiran yang muncul, atau string kosong kalau tidak ada",
  "mentorNotes": "1-2 kalimat pengamatan internal untuk mentor (pola yang kamu lihat, perlu follow-up apa) — JANGAN dibagikan ke mentee",
  "menteeEnergy": null | 1 | 2 | 3 | 4 | 5
}

Tentang menteeEnergy: 1=cemas, 2=datar, 3=stabil, 4=antusias, 5=on fire.
Tebak dari nada teks. Kalau ambigu, kembalikan null.`;
}

/** Call Gemini and parse the JSON draft. Throws on configuration or network
 *  errors; returns a partial draft (with empty fields) on parse failures. */
export async function summarizeSession(opts: SummarizeOptions): Promise<SessionDraft> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature: 0.4,        // factual-ish; don't fabricate
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(buildPrompt(opts));
  const raw = result.response.text();

  try {
    const parsed = JSON.parse(raw);
    return {
      topic: String(parsed.topic ?? "").slice(0, 120),
      summary: String(parsed.summary ?? ""),
      obstacles: String(parsed.obstacles ?? ""),
      mentorNotes: String(parsed.mentorNotes ?? ""),
      menteeEnergy:
        typeof parsed.menteeEnergy === "number" && parsed.menteeEnergy >= 1 && parsed.menteeEnergy <= 5
          ? Math.round(parsed.menteeEnergy)
          : null,
    };
  } catch {
    console.error("[gemini] response was not valid JSON:", raw.slice(0, 200));
    throw new Error("Gemini mengembalikan respons yang tidak terbaca. Coba lagi.");
  }
}
