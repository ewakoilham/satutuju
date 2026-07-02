/** Centralised transactional email helpers.
 *
 *  All Satu Tuju outbound mail goes through here so that:
 *    1. Sender + brand styling stay consistent.
 *    2. `from` and base URL are read from env in one place.
 *    3. Local dev without RESEND_API_KEY logs the email instead of failing.
 */

import { Resend } from "resend";

const FROM_DEFAULT = "Satu Tuju <noreply@satutuju.id>";

// Absolute, publicly-reachable logo for email clients (they can't use
// relative paths or our React Logo component, and many block SVG — so a
// hosted PNG on the live domain). Override with EMAIL_LOGO_URL if it moves.
const LOGO_URL = process.env.EMAIL_LOGO_URL || "https://www.satutuju.id/logo-main.png";

function appUrl(): string {
  // Canonical site origin for email links. Use the public var (set to
  // https://www.satutuju.id); do NOT fall back to the old APP_URL, which
  // pointed at a domain that no longer resolves. Trailing slash stripped so
  // `${base}/path` stays clean.
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.satutuju.id").replace(/\/+$/, "");
}

function fromAddress(): string {
  return process.env.INVITE_FROM_EMAIL || FROM_DEFAULT;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email] would send →", opts.to, "·", opts.subject);
    console.log("[email] preview:\n", opts.html.replace(/<[^>]+>/g, "").slice(0, 400));
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: fromAddress(), ...opts });
}

/** Common shell — header logo + footer disclaimer. All HTML is inlined
 *  because email clients don't trust external stylesheets. */
function shell(opts: {
  preheader: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  raw?: string;
}): string {
  const ctaHtml = opts.cta
    ? `<a href="${opts.cta.url}"
          style="display:inline-block;background:#3958b3;color:#fff;text-decoration:none;
                 padding:13px 28px;border-radius:10px;font-weight:600;margin:8px 0 24px;">
          ${opts.cta.label}
        </a>`
    : "";
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f4f8fa;">
      <span style="display:none;visibility:hidden;mso-hide:all;max-height:0;overflow:hidden;">${opts.preheader}</span>
      <div style="background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:28px;">
        <img src="${LOGO_URL}" alt="Satu Tuju" width="120" height="81"
             style="display:block;border:0;outline:none;text-decoration:none;height:auto;margin-bottom:18px;" />
        <h2 style="font-family:'Poppins',sans-serif;font-weight:800;font-size:24px;color:#111d42;line-height:1.2;letter-spacing:-0.01em;margin:0 0 12px;">
          ${opts.heading}
        </h2>
        <div style="color:#475569;font-size:14px;line-height:1.55;margin-bottom:18px;">${opts.body}</div>
        ${ctaHtml}
        ${opts.raw ?? ""}
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-top:18px;text-align:center;">
        Satu Tuju · Platform mentorship 1-on-1 untuk pelajar Indonesia menuju kampus impian.
      </p>
    </div>
  `;
}

/** Invite token email — admin invited a new mentor/mentee. */
export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  role: "mentor" | "mentee" | "admin";
  token: string;
}): Promise<void> {
  const activateUrl = `${appUrl()}/activate?token=${opts.token}`;
  const roleLabel = opts.role === "mentor" ? "mentor" : opts.role === "mentee" ? "mentee" : "admin";

  await send({
    to: opts.to,
    subject: `${opts.inviterName} mengundang kamu jadi ${roleLabel} di Satu Tuju`,
    html: shell({
      preheader: `Aktifkan akun ${roleLabel} kamu — 7 hari sebelum kedaluwarsa.`,
      heading: `Selamat datang di Satu Tuju.`,
      body: `
        <p>${opts.inviterName} mengundang kamu untuk bergabung sebagai <b>${roleLabel}</b>.</p>
        <p>Klik tombol di bawah untuk mengaktifkan akun dan memilih cara masuk
           (Google atau buat kunci sendiri). Tautan ini berlaku 7 hari.</p>
      `,
      cta: { label: "Aktifkan akun", url: activateUrl },
      raw: `<p style="color:#94a3b8;font-size:12px;margin-top:6px;">
        Atau salin tautan ini ke browser kamu:<br><span style="word-break:break-all;color:#475569;">${activateUrl}</span>
      </p>`,
    }),
  });
}

/** Magic-link password reset. */
export async function sendResetEmail(opts: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const resetUrl = `${appUrl()}/reset-password?token=${opts.token}`;
  await send({
    to: opts.to,
    subject: "Reset kunci Satu Tuju kamu",
    html: shell({
      preheader: "Tautan reset berlaku 24 jam.",
      heading: "Reset kunci kamu.",
      body: `
        <p>Hai ${opts.name},</p>
        <p>Kami terima permintaan reset kunci. Klik tombol di bawah untuk
           memilih kunci baru. Tautan berlaku 24 jam dan hanya bisa dipakai
           sekali.</p>
      `,
      cta: { label: "Pilih kunci baru", url: resetUrl },
      raw: `<p style="color:#94a3b8;font-size:12px;margin-top:6px;">
        Kalau bukan kamu yang request, abaikan email ini — kunci kamu tidak berubah.
      </p>`,
    }),
  });
}

/** Notify mentee that their session plan has been finalised. Used in Phase B. */
export async function sendSessionPlanFinalizedEmail(opts: {
  to: string;
  menteeName: string;
  mentorName: string;
  pairingId: string;
  totalSessions: number;
}): Promise<void> {
  const url = `${appUrl()}/dashboard/mentee/${opts.pairingId}/rencana-sesi`;
  await send({
    to: opts.to,
    subject: `${opts.mentorName} sudah menyusun rencana sesi kamu`,
    html: shell({
      preheader: `${opts.totalSessions} sesi dirancang untuk perjalanan mentoring kamu.`,
      heading: `Rencana sesi dari ${opts.mentorName}.`,
      body: `
        <p>Hai ${opts.menteeName},</p>
        <p>${opts.mentorName} sudah menyusun rencana <b>${opts.totalSessions} sesi</b>
           untuk perjalanan mentoring kamu. Lihat detail per-sesi, topik, dan
           estimasi total waktu di halaman rencana sesi.</p>
      `,
      cta: { label: "Lihat rencana sesi", url },
    }),
  });
}

/* ── Admin ops alerts ─────────────────────────────────────────────────────
   Operational events the admin must act on quickly (deposit verification
   gates booking; bookings need oversight). Sent to the admin inbox —
   ADMIN_NOTIFY_EMAIL, default admin@satutuju.id. Best-effort: failures are
   logged and never break the API call that triggered them. */

function adminNotifyAddress(): string {
  return process.env.ADMIN_NOTIFY_EMAIL || "admin@satutuju.id";
}

async function sendAdminOps(opts: {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}): Promise<void> {
  try {
    await send({
      to: adminNotifyAddress(),
      subject: opts.subject,
      html: shell({
        preheader: opts.preheader,
        heading: opts.heading,
        body: opts.body,
        cta: opts.cta,
      }),
    });
  } catch (e) {
    console.error("[email] admin ops send failed:", e);
  }
}

/** Deposit proof uploaded — verification now gates session booking, so the
 *  admin needs to jump on it. */
export async function sendAdminDepositUploadedEmail(opts: {
  menteeName: string;
  menteeUserId: string;
  reupload: boolean;
  transferNote?: string | null;
}): Promise<void> {
  await sendAdminOps({
    subject: `${opts.reupload ? "[Re-upload] " : ""}Bukti deposit: ${opts.menteeName}`,
    preheader: "Perlu verifikasi — booking sesi mentee terbuka setelah deposit diverifikasi.",
    heading: opts.reupload ? "Bukti deposit diunggah ulang." : "Bukti deposit baru masuk.",
    body: `
      <p><b>${opts.menteeName}</b> baru saja mengunggah bukti transfer deposit.</p>
      ${opts.transferNote ? `<p>Catatan transfer: <i>${opts.transferNote}</i></p>` : ""}
      <p>Booking sesi mentee ini terbuka begitu deposit diverifikasi — mohon
         cek secepatnya supaya mentee tidak menunggu.</p>
    `,
    cta: { label: "Verifikasi sekarang", url: `${appUrl()}/dashboard/admin/deposits/${opts.menteeUserId}` },
  });
}

/** Booking lifecycle — request / confirmed / rejected / cancelled. */
export async function sendAdminBookingEmail(opts: {
  kind: "requested" | "accepted" | "rejected" | "cancelled";
  mentorName: string;
  menteeName: string;
  date: string;
  time: string;
  sessionLabel?: string | null;
  reason?: string | null;
}): Promise<void> {
  const KIND: Record<typeof opts.kind, { subject: string; heading: string; line: string }> = {
    requested: {
      subject: `Booking baru: ${opts.menteeName} → ${opts.mentorName}`,
      heading: "Request sesi baru.",
      line: `<b>${opts.menteeName}</b> mengajukan sesi ke <b>${opts.mentorName}</b> — menunggu konfirmasi mentor.`,
    },
    accepted: {
      subject: `Sesi terkonfirmasi: ${opts.mentorName} × ${opts.menteeName}`,
      heading: "Sesi terkonfirmasi.",
      line: `<b>${opts.mentorName}</b> menerima request sesi dari <b>${opts.menteeName}</b>.`,
    },
    rejected: {
      subject: `Request ditolak: ${opts.mentorName} × ${opts.menteeName}`,
      heading: "Request sesi ditolak.",
      line: `<b>${opts.mentorName}</b> menolak request sesi dari <b>${opts.menteeName}</b>.`,
    },
    cancelled: {
      subject: `Sesi dibatalkan: ${opts.mentorName} × ${opts.menteeName}`,
      heading: "Sesi terkonfirmasi dibatalkan.",
      line: `<b>${opts.mentorName}</b> membatalkan sesi yang sudah terkonfirmasi dengan <b>${opts.menteeName}</b>.`,
    },
  };
  const k = KIND[opts.kind];
  await sendAdminOps({
    subject: k.subject,
    preheader: `${opts.date} · ${opts.time}`,
    heading: k.heading,
    body: `
      <p>${k.line}</p>
      <p>📅 <b>${opts.date}</b> · ${opts.time}${opts.sessionLabel ? `<br/>📚 ${opts.sessionLabel}` : ""}</p>
      ${opts.reason ? `<p>Alasan: <i>${opts.reason}</i></p>` : ""}
    `,
    cta: { label: "Buka jadwal", url: `${appUrl()}/dashboard/schedule` },
  });
}
