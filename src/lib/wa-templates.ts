/** WhatsApp deep-link templates used by Beranda + Mentee + Sesi screens.
 *
 *  Three reasons-to-message a mentee with hand-tuned tone — friendly, no
 *  pressure, builds context. `wa.me/<phone>?text=<encoded>` opens WhatsApp
 *  Web / app with the chat pre-filled; the user still has to press send.
 *
 *  Phone numbers come from MenteeProfile.phoneNumber. We strip non-digits and
 *  drop a leading 0 (Indonesian local format) so the link works on any device.
 *  If a number is missing, the caller should fall back to opening WhatsApp's
 *  contact search.
 */

export type WaTemplateKind = "reminder" | "reengage" | "checkin";

export interface WaContext {
  /** Mentee's display name. Used to personalize the greeting. */
  menteeName?: string;
  /** Mentor's display name. Sign-off. Defaults to "mentor kamu". */
  mentorName?: string;
  /** Session number, if the message is tied to a specific session. */
  sessionNum?: number | null;
  /** Human-readable session time, e.g. "Sabtu 14:00 WIB". */
  sessionWhen?: string | null;
  /** Days since last sesssion (used by `reengage`). */
  jedaHari?: number | null;
}

/** Renders the template body. Markdown-light: just newlines, no formatting. */
export function renderWaTemplate(kind: WaTemplateKind, ctx: WaContext): string {
  const firstName = (ctx.menteeName?.split(/\s+/)[0] || "").trim();
  const mentor = ctx.mentorName?.split(/\s+/)[0] || "mentor kamu";
  const sesi = ctx.sessionNum ? ` Sesi ${ctx.sessionNum}` : "";
  const when = ctx.sessionWhen ? ` (${ctx.sessionWhen})` : "";

  switch (kind) {
    case "reminder":
      return [
        `Hai ${firstName || "kamu"} 👋`,
        ``,
        `Sekedar reminder ringan, sesi mentoring kita${sesi}${when} ya. Aku sudah blok jadwal — kalau ada yang berubah dari sisi kamu kasih kabar.`,
        ``,
        `Sebelum sesi, kalau sempat coba siapin dokumen / draft yang kita bahas terakhir. Ga harus rapi, yang penting kita punya bahan untuk diskusi.`,
        ``,
        `Sampai ketemu nanti! — ${mentor}`,
      ].join("\n");

    case "reengage":
      return [
        `Hai ${firstName || "kamu"} 👋`,
        ``,
        ctx.jedaHari && ctx.jedaHari > 0
          ? `Udah ${ctx.jedaHari} hari kita ga ngobrol. Apa kabar?`
          : `Apa kabar? Lama ga ngobrol nih.`,
        ``,
        `No pressure soal jadwal mentoring dulu — aku cuma mau cek kamu lagi gimana. Ada hal yang lagi berat? Atau lagi sibuk persiapan lain? Kasih tau aja.`,
        ``,
        `Kalau memang lagi mau jeda mentoring sebentar, juga ga apa-apa. Lebih baik kita atur ulang ekspektasi daripada kamu ngerasa harus catch up sendiri.`,
        ``,
        `— ${mentor}`,
      ].join("\n");

    case "checkin":
      return [
        `Hai ${firstName || "kamu"} 👋`,
        ``,
        `Mau cek aja, gimana progress ${sesi ? `setelah${sesi}` : "minggu ini"}? Ada yang stuck atau pertanyaan yang muncul setelah kita ngobrol terakhir?`,
        ``,
        `Kalau ada draft / dokumen baru yang mau aku review duluan sebelum sesi berikutnya, kirim aja ke sini.`,
        ``,
        `— ${mentor}`,
      ].join("\n");
  }
}

export interface WaTemplateMeta {
  kind: WaTemplateKind;
  label: string;
  description: string;
}

export const WA_TEMPLATES: WaTemplateMeta[] = [
  {
    kind: "reminder",
    label: "Pengingat sesi",
    description: "Reminder ringan sebelum sesi terjadwal. Cocok 1 hari sebelum.",
  },
  {
    kind: "checkin",
    label: "Check-in ringan",
    description: "Tanya progress setelah sesi tanpa nge-push.",
  },
  {
    kind: "reengage",
    label: "Re-engagement",
    description: "Untuk mentee yang sudah lama nggak ngobrol (jeda 14+ hari).",
  },
];

/** Indonesian phone normalization: strips spaces/dashes/+/parens, then
 *  normalizes a leading 0 to 62 so `wa.me` resolves correctly. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits; // common shorthand
  return digits;
}

/** Builds the full wa.me link. Returns null if phone is unusable (so the
 *  caller can fall back to wa.me/ for contact search). */
export function buildWaLink(phone: string | null | undefined, body: string): string {
  const normalized = phone ? normalizePhone(phone) : null;
  const encoded = encodeURIComponent(body);
  if (!normalized) return `https://wa.me/?text=${encoded}`;
  return `https://wa.me/${normalized}?text=${encoded}`;
}

/** One-call convenience: render + build link. */
export function waUrl(kind: WaTemplateKind, ctx: WaContext, phone: string | null | undefined): string {
  return buildWaLink(phone, renderWaTemplate(kind, ctx));
}
