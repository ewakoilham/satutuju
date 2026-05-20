import type { LeadBucket } from "@/lib/leads/types";

const STYLES: Record<LeadBucket, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-teal-100",   text: "text-teal-800",   label: "A" },
  B: { bg: "bg-amber-100",  text: "text-amber-800",  label: "B" },
  // C = partner kampus only (mentor missing) — neutral/positive blue
  C: { bg: "bg-blue-100",   text: "text-blue-800",   label: "C" },
  // D = neither mentor nor partner — warning red
  D: { bg: "bg-red-100",    text: "text-red-800",    label: "D" },
  // Target field empty in Tally — soft slate, needs re-engagement
  incomplete:   { bg: "bg-slate-100",  text: "text-slate-700",  label: "✎" },
  // Target = domestic Indonesia (out of scope for Satu Tuju) — indigo
  domestic:     { bg: "bg-indigo-100", text: "text-indigo-800", label: "ID" },
  unclassified: { bg: "bg-surface-elevated", text: "text-text-muted", label: "?" },
};

export default function LeadBucketBadge({ bucket }: { bucket: LeadBucket }) {
  const s = STYLES[bucket];
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-bold ${s.bg} ${s.text}`}
      title={`Bucket ${s.label}`}
    >
      {s.label}
    </span>
  );
}
