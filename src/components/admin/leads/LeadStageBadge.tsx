import type { LeadStage } from "@/lib/leads/types";

const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  outreach_sent: "Outreach Sent",
  email_opened: "Email Opened",
  email_clicked: "Email Clicked",
  call_scheduled: "Call Scheduled",
  call_completed: "Call Completed",
  deposit_pending: "Deposit Pending",
  deposit_paid: "Deposit Paid",
  matched: "Matched",
  declined: "Declined",
  waitlist: "Waitlist",
  rejected: "Rejected",
};

const STAGE_TONE: Record<LeadStage, string> = {
  new:             "bg-surface-elevated text-text-muted",
  outreach_sent:   "bg-blue-50 text-blue-700",
  email_opened:    "bg-blue-100 text-blue-800",
  email_clicked:   "bg-indigo-100 text-indigo-800",
  call_scheduled:  "bg-violet-100 text-violet-800",
  call_completed:  "bg-violet-200 text-violet-900",
  deposit_pending: "bg-amber-100 text-amber-800",
  deposit_paid:    "bg-emerald-100 text-emerald-800",
  matched:         "bg-emerald-200 text-emerald-900",
  declined:        "bg-rose-100 text-rose-800",
  waitlist:        "bg-yellow-100 text-yellow-900",
  rejected:        "bg-zinc-200 text-zinc-700",
};

export default function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${STAGE_TONE[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}
