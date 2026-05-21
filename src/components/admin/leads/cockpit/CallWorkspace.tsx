"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { fundingPlanLabelId, type Lead, type LeadBucket } from "@/lib/leads/types";

/**
 * Center workspace of the Call Cockpit — three tabs:
 *
 *   1. Pre-call brief — AI-generated summary + 2 columns of "Yang harus
 *      ditanyakan" / "Risiko". Static content derived from lead.bucket
 *      + fundingPlan + parsedCountry. Plus a quick-template chip row
 *      that the admin can drop into the Live notes textarea.
 *
 *   2. Live notes — readiness checklist (5 cards, hint-expandable) +
 *      catatan call textarea + red flags textarea. State is owned by
 *      the parent page so the right Decision Pad stays in sync.
 *
 *   3. Original form — Lead.targetCampusAndProgram + funding + WA +
 *      submitted-at, framed as if it were the Tally form Q&A snapshot.
 *      We don't store the full Tally field map yet, so this surfaces
 *      what we DO have plus a note that the source-of-truth lives in
 *      Tally.
 */

export interface ReadinessItem {
  short: string;
  label: string;
  hint: string;
  askExample: string;
}

const DEFAULT_READINESS: ReadinessItem[] = [
  {
    short: "IELTS / equivalent",
    label: "Sudah punya skor IELTS / equivalent (atau plan-nya jelas)",
    hint: "Tanya skor per skill, target re-take kalau di bawah requirement kampus.",
    askExample: '"Skornya berapa per band? Ada plan re-take untuk skill yang kurang?"',
  },
  {
    short: "Shortlist kampus",
    label: "Sudah ada 3+ kampus shortlist + program-nya",
    hint: "Kalau hanya 1 kampus, dorong eksplorasi 2 alternatif (negara sama atau berbeda).",
    askExample: '"Selain pilihan utama, ada plan B atau C? Sudah research entry requirement-nya?"',
  },
  {
    short: "Funding plan jelas",
    label: "Funding plan jelas (LPDP / self-funded / partial)",
    hint: "Kalau LPDP: tahap mana, sudah punya LoA conditional? Self-funded: estimasi total biaya?",
    askExample: '"Sudah di tahap apa LPDP-nya? Ada Plan B funding kalau ditolak?"',
  },
  {
    short: "Timeline realistis",
    label: "Timeline aplikasi realistis (intake target, deadline-aware)",
    hint: "Map deadline aplikasi, deadline LoA untuk LPDP/sponsor, dan tahapan re-take test kalau perlu.",
    askExample: '"Sudah mapping deadline-nya bulan apa saja? Kapan target submit?"',
  },
  {
    short: "Essay draft / outline",
    label: "Motivasi essay sudah ada draft / outline",
    hint: "Kalau belum: tanyakan strong-points yang sudah ada. Kalau ada: tawarkan review essay di sesi kedua.",
    askExample: '"Sudah ada draft outline statement of purpose? Bisa di-share dulu?"',
  },
];

const TEMPLATE_CHIPS = [
  "Icebreaker",
  "Background akademik",
  "Target & motivasi",
  "Funding deep-dive",
  "Timeline & deadline",
  "Pertanyaan dari mentee",
];

interface Props {
  lead: Lead;
  readiness: boolean[];
  onToggleReadiness: (i: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  redFlags: string;
  onRedFlagsChange: (v: string) => void;
  interviewer: string;
  onInterviewerChange: (v: string) => void;
  readOnly: boolean;
}

type TabId = "brief" | "live" | "form";

export default function CallWorkspace(props: Props) {
  const [tab, setTab] = useState<TabId>("live");

  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "brief", label: "Pre-call brief", icon: "sparkles" },
    { id: "live", label: "Live notes", icon: "lightning" },
    { id: "form", label: "Original form", icon: "inbox" },
  ];

  return (
    <main className="flex-1 min-w-0 bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border px-4 gap-1 items-end bg-surface-elevated/30">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-3 text-[13px] -mb-px border-b-2 transition ${
                active
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-text-muted font-medium hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "brief" && <BriefTab lead={props.lead} onTemplateInsert={(label) => props.onNotesChange((props.notes ? props.notes + "\n\n" : "") + `## ${label}\n- `)} />}
        {tab === "live" && (
          <LiveTab {...props} />
        )}
        {tab === "form" && <FormTab lead={props.lead} />}
      </div>
    </main>
  );
}

// ─── Pre-call brief ────────────────────────────────────────────────

interface Brief {
  summary: string;
  priorities: string[];
  risks: string[];
}

function buildBrief(lead: Lead): Brief {
  const country = lead.parsedCountry ?? "negara tujuan";
  const campus = lead.parsedCampus ?? "kampus tujuan";

  const summary: string = (() => {
    switch (lead.bucket) {
      case "A":
        return `Lead kuat: bucket A (mentor + partner kampus). ${campus} di ${country} sesuai field ${lead.parsedField ?? "—"}, funding ${fundingPlanLabelId(lead.fundingPlan)}. Potensi tinggi untuk fast-track ke matched.`;
      case "B":
        return `Bucket B — mentor di ${country} tersedia, tapi ${campus} bukan partner. Konfirmasi mentee terbuka untuk alternatif kampus partner di negara yang sama.`;
      case "C":
        return `Bucket C — kampus ${campus} partner, tapi belum ada mentor di ${country}. Diskusi opsi mentor lintas-region atau waitlist.`;
      case "D":
        return `Bucket D — mentor & kampus belum tersedia. Diskusi opsi alternatif region/kampus yang dicover.`;
      case "incomplete":
        return "Form Tally belum lengkap — target kampus/program kosong. Fokus minta info lengkap supaya bisa diklasifikasi ulang.";
      case "domestic":
        return "Target studi domestik (Indonesia) — di luar scope Satu Tuju. Diskusi opsi komunitas alternatif.";
      default:
        return "Bucket belum diklasifikasi. Konfirmasi target studi + funding sebelum lanjut.";
    }
  })();

  const priorities: string[] = (() => {
    const items: string[] = [];
    if (lead.fundingPlan === "scholarship") {
      items.push("Konfirmasi tahap aplikasi beasiswa (LPDP / lainnya) + plan B kalau ditolak");
    } else if (lead.fundingPlan === "self_funded") {
      items.push("Konfirmasi estimasi total biaya + sumber dana (orang tua, tabungan, partial sponsor)");
    } else if (lead.fundingPlan === "partial") {
      items.push("Konfirmasi proporsi beasiswa vs mandiri + sumber gap funding");
    }
    items.push(`Tanya supervisor target di ${campus} — apakah sudah ada kontak`);
    if (lead.bucket === "A" || lead.bucket === "C") {
      items.push("Tawarkan mentor partner kampus untuk insights aplikasi langsung");
    }
    if (lead.bucket === "B") {
      items.push("Tawarkan eksplorasi 2-3 kampus partner alternatif di negara yang sama");
    }
    items.push("Klarifikasi timeline intake + deadline aplikasi terkait");
    return items;
  })();

  const risks: string[] = (() => {
    const items: string[] = [];
    if (lead.bucket === "incomplete") {
      items.push("Target kampus/program kosong — risk tertinggi, pasti tanya dulu");
    }
    if (lead.bucket === "D") {
      items.push("Coverage region/kampus belum ada — risk decline tinggi kalau mentee tidak terbuka alternatif");
    }
    if (lead.fundingPlan === "self_funded") {
      items.push("Self-funded — pastikan kapasitas finansial real (>= biaya tuition + living 1 tahun)");
    }
    if (!lead.whatsappNumber) {
      items.push("Lead tanpa WA — komunikasi follow-up cuma via email, lebih lambat");
    }
    items.push("Hanya 1 kampus shortlist = high risk kalau ditolak");
    return items;
  })();

  return { summary, priorities, risks };
}

function BriefTab({ lead, onTemplateInsert }: { lead: Lead; onTemplateInsert: (label: string) => void }) {
  const brief = buildBrief(lead);
  return (
    <div className="p-6">
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-5">
        <div className="flex gap-2.5 items-start">
          <Icon name="sparkles" size={16} className="text-yellow-700 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[11px] font-bold text-yellow-800 uppercase tracking-[0.06em]">
              Saran AI pre-call
            </div>
            <div className="text-[13.5px] text-yellow-900 leading-relaxed mt-1">{brief.summary}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BriefCol title="Yang HARUS ditanyakan" items={brief.priorities} accent="primary" icon="check" />
        <BriefCol title="Risiko / red flag potensial" items={brief.risks} accent="danger" icon="flag" />
      </div>

      <div className="mt-6 p-4 rounded-xl bg-surface-elevated/40">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon name="sparkles" size={14} className="text-primary" />
          <div className="text-[12px] font-semibold text-foreground">
            Quick template — tap untuk insert ke Live notes
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATE_CHIPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTemplateInsert(t)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-border bg-surface text-foreground hover:border-primary-200 hover:text-primary transition"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[12px] text-text-muted-2 flex items-center gap-1.5">
        <Icon name="clock" size={12} />
        Tab &ldquo;Live notes&rdquo; lebih nyaman saat panggilan — checklist readiness ke-update otomatis ke deposit tier di kanan.
      </div>
    </div>
  );
}

function BriefCol({ title, items, accent, icon }: { title: string; items: string[]; accent: "primary" | "danger"; icon: string }) {
  const color = accent === "primary" ? "text-primary" : "text-rose-700";
  return (
    <div>
      <div className={`text-[11px] font-bold uppercase tracking-[0.06em] mb-2.5 ${color}`}>{title}</div>
      <ul className="space-y-2">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-foreground leading-snug">
            <span className={`${color} mt-0.5 flex-shrink-0`}>
              <Icon name={icon} size={12} />
            </span>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Live notes ───────────────────────────────────────────────────

function LiveTab({
  readiness,
  onToggleReadiness,
  notes,
  onNotesChange,
  redFlags,
  onRedFlagsChange,
  interviewer,
  onInterviewerChange,
  readOnly,
}: Pick<Props, "readiness" | "onToggleReadiness" | "notes" | "onNotesChange" | "redFlags" | "onRedFlagsChange" | "interviewer" | "onInterviewerChange" | "readOnly">) {
  const score = readiness.filter(Boolean).length;
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="p-6 space-y-6">
      {/* Interviewer */}
      <div className="space-y-1.5 max-w-md">
        <div className="text-[11px] font-bold text-text-muted-2 uppercase tracking-[0.06em]">
          Interviewer
        </div>
        <input
          type="text"
          value={interviewer}
          onChange={(e) => onInterviewerChange(e.target.value)}
          disabled={readOnly}
          placeholder="mis. Razak, Venzo, ..."
          className="input-field text-sm"
        />
      </div>

      {/* Readiness */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-[11px] font-bold text-text-muted-2 uppercase tracking-[0.06em]">
              Readiness checklist
            </div>
            <div className="text-[12px] text-text-muted mt-0.5">
              Centang saat mentee mengkonfirmasi. Score → suggest deposit tier di kanan.
            </div>
          </div>
          <div className="text-[12px] text-text-muted">
            Score: <strong className="text-primary text-[14px] tabular-nums">{score} / 5</strong>
          </div>
        </div>
        <div className="space-y-2">
          {DEFAULT_READINESS.map((item, i) => (
            <ReadinessCard
              key={i}
              item={item}
              checked={readiness[i]}
              onToggle={() => onToggleReadiness(i)}
              disabled={readOnly}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <NoteSection
        label="Catatan call"
        icon="sparkles"
        hint="Tulis bebas — markdown OK. Gunakan template chip di tab Pre-call brief untuk header."
        value={notes}
        onChange={onNotesChange}
        rows={8}
        disabled={readOnly}
        wordCount={wordCount(notes)}
        placeholder={"## Background\n- \n\n## Target & motivasi\n- \n\n## Funding\n- \n\n## Action items\n- [ ] "}
      />
      <NoteSection
        label="Red flags"
        icon="flag"
        hint="Concerns serius yang admin lain perlu tahu. Akan muncul di header lead row."
        value={redFlags}
        onChange={onRedFlagsChange}
        rows={3}
        disabled={readOnly}
        wordCount={wordCount(redFlags)}
        placeholder="Mis. timeline tidak realistis, IELTS jauh di bawah requirement, motivasi unclear..."
        accent="danger"
      />
    </div>
  );
}

function ReadinessCard({
  item,
  checked,
  onToggle,
  disabled,
}: {
  item: ReadinessItem;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border transition-colors ${
        checked ? "border-primary-200 bg-primary-50/50" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={item.short}
          className={`w-5.5 h-5.5 rounded-md border inline-flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
            checked ? "bg-primary border-primary text-white" : "bg-surface border-border"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          style={{ width: 22, height: 22 }}
        >
          {checked && <Icon name="check" size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-foreground leading-snug">{item.label}</div>
          {open && (
            <div className="mt-2.5 p-2.5 rounded-lg border border-border/60 bg-surface text-[12.5px] text-text-muted leading-relaxed">
              <div className="text-foreground mb-1.5">
                <strong>Konteks:</strong> {item.hint}
              </div>
              <div className="flex gap-1.5 items-start">
                <Icon name="chat" size={12} className="text-primary mt-0.5 flex-shrink-0" />
                <em>{item.askExample}</em>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-text-muted-2 hover:text-foreground rounded px-1"
        >
          <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
          {open ? "Sembunyikan" : "Hint"}
        </button>
      </div>
    </div>
  );
}

function NoteSection({
  label,
  icon,
  hint,
  value,
  onChange,
  rows,
  disabled,
  wordCount,
  placeholder,
  accent,
}: {
  label: string;
  icon: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  disabled: boolean;
  wordCount: number;
  placeholder: string;
  accent?: "danger";
}) {
  const accentClass = accent === "danger" ? "text-rose-700" : "text-text-muted-2";
  const borderClass = accent === "danger" ? "border-rose-200 focus:border-rose-400" : "border-border focus:border-primary";
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div
            className={`text-[11px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-1.5 ${accentClass}`}
          >
            <Icon name={icon} size={12} />
            {label}
          </div>
          <div className="text-[11.5px] text-text-muted mt-0.5">{hint}</div>
        </div>
        <div className="text-[11px] text-text-muted-2 tabular-nums">
          {wordCount} kata
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full p-3 rounded-xl border text-[13px] leading-relaxed font-mono outline-none disabled:opacity-60 transition ${borderClass}`}
      />
    </div>
  );
}

// ─── Original form ────────────────────────────────────────────────

function FormTab({ lead }: { lead: Lead }) {
  // We don't store full Tally Q&A snapshot — surface what we DO have
  // in a consistent layout so admin can scan during call.
  const fields: Array<{ q: string; a: string | null }> = [
    { q: "Nama", a: lead.name },
    { q: "Email", a: lead.email },
    { q: "WhatsApp", a: lead.whatsappNumber },
    { q: "Target kampus & program", a: lead.targetCampusAndProgram || null },
    { q: "Rencana pendanaan", a: fundingPlanLabelId(lead.fundingPlan) },
    { q: "Bucket (auto-classification)", a: `${lead.bucket} — ${bucketDescLong(lead.bucket)}` },
  ];

  const submittedStamp = new Date(lead.submittedAt).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="p-6">
      <div className="text-[12.5px] text-text-muted mb-4">
        Jawaban asli dari Tally · submitted {submittedStamp}
      </div>
      <div className="space-y-2.5">
        {fields.map((qa, i) => (
          <div key={i} className="p-3.5 rounded-xl bg-surface-elevated/40">
            <div className="text-[11.5px] text-text-muted-2 font-semibold mb-1">
              Q{i + 1}. {qa.q}
            </div>
            <div className="text-[13.5px] text-foreground leading-snug">
              {qa.a || <span className="italic text-text-muted-2">tidak diisi</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 p-3 rounded-lg bg-surface-elevated/30 text-[11.5px] text-text-muted italic">
        Catatan: kita hanya simpan field-field di atas. Untuk jawaban form lengkap (history per submission), buka Tally Dashboard.
      </div>
    </div>
  );
}

function bucketDescLong(bucket: LeadBucket | string): string {
  switch (bucket) {
    case "A": return "Mentor + partner kampus tersedia";
    case "B": return "Mentor tersedia, kampus bukan partner";
    case "C": return "Kampus partner, mentor belum tersedia";
    case "D": return "Mentor & kampus belum tersedia";
    case "incomplete": return "Form belum lengkap";
    case "domestic": return "Target studi di Indonesia";
    default: return "Perlu review manual";
  }
}
