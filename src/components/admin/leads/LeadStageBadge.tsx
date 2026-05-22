import { STAGE_LABEL, type LeadStage } from "@/lib/leads/types";

/**
 * Color tone per stage. Labels come from STAGE_LABEL in types.ts so
 * every surface in the app reads the same wording. Tones are scoped
 * to stay close to the funnel-progression intuition (slate → blue →
 * indigo → violet → amber → emerald → terminal).
 */
const STAGE_TONE: Record<LeadStage, string> = {
  new:             "bg-surface-elevated text-text-muted",
  outreach_sent:   "bg-blue-50 text-blue-700",
  whatsapp_read:   "bg-emerald-50 text-emerald-800",
  email_opened:    "bg-blue-100 text-blue-800",
  email_clicked:   "bg-indigo-100 text-indigo-800",
  call_scheduled:  "bg-violet-100 text-violet-800",
  call_completed:  "bg-violet-200 text-violet-900",
  deposit_pending: "bg-amber-100 text-amber-800",
  deposit_agreed:  "bg-lime-100 text-lime-800",
  deposit_paid:    "bg-emerald-100 text-emerald-800",
  matched:         "bg-emerald-200 text-emerald-900",
  declined:        "bg-rose-100 text-rose-800",
  waitlist:        "bg-yellow-100 text-yellow-900",
  rejected:        "bg-zinc-200 text-zinc-700",
};

export default function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const label = STAGE_LABEL[stage] ?? stage;
  const tone = STAGE_TONE[stage] ?? STAGE_TONE.new;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
