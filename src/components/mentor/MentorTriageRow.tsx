"use client";

import Icon from "@/components/ui/Icon";
import { formatJakartaDateTime, formatJakartaRelative } from "@/lib/datetime-id";
import type { MentorLeadView } from "@/lib/leads/types";
import CountryPill from "./CountryPill";
import FundingPill from "./FundingPill";

/**
 * Phase 16 — single row in the mentor leads triage stream.
 *
 * Layout:
 *   [avatar] [name + Cocok-negaraku badge / email · target / pills]
 *   [flag + notes indicators][relative time]
 *
 * The whole row is clickable → opens the detail slide-over (parent
 * owns the open state). Active row gets a primary-tinted background.
 * Flagged rows get a soft amber left border.
 */

interface Props {
  lead: MentorLeadView;
  isActive: boolean;
  onClick: () => void;
}

/** Deterministic avatar background tint based on a name hash. Same
 *  hash for the same name across renders → visual recall. */
function avatarTint(name: string): { bg: string; fg: string } {
  const palette: Array<{ bg: string; fg: string }> = [
    { bg: "bg-primary-50",  fg: "text-primary" },
    { bg: "bg-violet-100",  fg: "text-violet-700" },
    { bg: "bg-amber-100",   fg: "text-amber-700" },
    { bg: "bg-emerald-100", fg: "text-emerald-700" },
    { bg: "bg-rose-100",    fg: "text-rose-700" },
    { bg: "bg-sky-100",     fg: "text-sky-700" },
    { bg: "bg-fuchsia-100", fg: "text-fuchsia-700" },
    { bg: "bg-teal-100",    fg: "text-teal-700" },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

const NO_TARGET_RX = /^\s*\(target (tidak|belum) diisi\)\s*$/i;

export default function MentorTriageRow({ lead, isActive, onClick }: Props) {
  const tint = avatarTint(lead.name);
  const initials = lead.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const targetEmpty = !lead.targetCampusAndProgram || NO_TARGET_RX.test(lead.targetCampusAndProgram);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full grid items-center gap-3 px-4 py-3 text-left transition border-l-[3px] ${
        isActive
          ? "bg-primary-50/60 border-l-primary"
          : lead.flaggedByMe
            ? "bg-amber-50/40 border-l-amber-300 hover:bg-amber-50/70"
            : "bg-surface hover:bg-surface-elevated/40 border-l-transparent"
      }`}
      style={{ gridTemplateColumns: "40px minmax(0,1fr) auto 104px" }}
    >
      <div className={`w-10 h-10 rounded-full ${tint.bg} ${tint.fg} flex items-center justify-center text-[12px] font-bold flex-shrink-0`}>
        {initials}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-bold text-[14px] text-foreground truncate">{lead.name}</span>
          {lead.matchesMyCountry && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 flex-shrink-0"
              title="Negara studi lead sama dengan negara studimu"
            >
              <Icon name="sparkles" size={9} /> Negara studiku
            </span>
          )}
        </div>
        <div className="text-[12px] text-text-muted truncate mb-1.5">
          <span className="font-mono text-[11.5px]">{lead.email}</span>
          {!targetEmpty && (
            <>
              <span className="mx-1.5 text-text-muted-2">·</span>
              <span className="text-text-muted-2">{lead.targetCampusAndProgram}</span>
            </>
          )}
          {targetEmpty && (
            <>
              <span className="mx-1.5 text-text-muted-2">·</span>
              <span className="text-text-muted-2 italic">target belum diisi</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <CountryPill country={lead.parsedCountry} />
          {lead.fundingPlan && <FundingPill funding={lead.fundingPlan} />}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[200px]">
        {lead.flaggedByMe && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
            title="Sudah kamu tandai"
          >
            <Icon name="flag" size={10} /> Saya tandai
          </span>
        )}
        {lead.noteCount > 0 && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold relative ${
              lead.hasUnreadAdminReply
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-primary-50 text-primary border border-primary-100"
            }`}
            title={lead.hasUnreadAdminReply ? "Admin sudah balas catatanmu" : `${lead.noteCount} catatan`}
          >
            <Icon name="chat" size={10} />
            {lead.noteCount}
            {lead.hasUnreadAdminReply && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-600 border border-surface"
                aria-hidden
              />
            )}
          </span>
        )}
      </div>

      <div
        className="text-[11px] text-text-muted-2 tabular-nums text-right whitespace-nowrap"
        title={lead.submittedAt ? formatJakartaDateTime(lead.submittedAt) : ""}
      >
        {lead.submittedAt ? formatJakartaRelative(lead.submittedAt) : "—"}
      </div>
    </button>
  );
}
