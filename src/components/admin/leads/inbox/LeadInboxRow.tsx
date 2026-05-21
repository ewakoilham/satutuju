"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import LeadAvatar from "./LeadAvatar";
import EngagementIcons from "./EngagementIcons";
import ProgressDots from "./ProgressDots";
import { fundingPlanLabelId, type Lead } from "@/lib/leads/types";

/**
 * Single row in the Smart Inbox list. Designed to be dense + scannable:
 *
 *   [☐] [avatar]  Name + email   |  Target + country/funding   |  Bucket  Stage  Engage   Progress dots   [quick actions on hover]
 *
 * Quick actions (mail / WA / calendar) only appear on hover so the
 * resting state stays calm. The whole row is clickable to open the
 * detail slide-over — checkbox and icon buttons stop propagation.
 */

interface Props {
  lead: Lead;
  selected: boolean;
  isActive: boolean;
  progress: { done: number; total: number };
  onSelect: () => void;
  onOpen: () => void;
  onReachout: (channel: "email" | "whatsapp" | "both") => void;
  onScheduleCall: () => void;
  busy: boolean;
}

export default function LeadInboxRow({
  lead,
  selected,
  isActive,
  progress,
  onSelect,
  onOpen,
  onReachout,
  onScheduleCall,
  busy,
}: Props) {
  const [hover, setHover] = useState(false);
  const hasWa = !!lead.whatsappNumber;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      className={`grid items-center gap-3 px-4 py-2.5 cursor-pointer text-[13px] text-foreground border-l-[3px] transition-colors ${
        isActive
          ? "bg-primary-50 border-l-primary"
          : selected
            ? "bg-slate-50 border-l-transparent"
            : hover
              ? "bg-surface-elevated/40 border-l-transparent"
              : "bg-surface border-l-transparent"
      }`}
      style={{
        gridTemplateColumns:
          "24px 32px minmax(0, 1.4fr) minmax(0, 1.5fr) auto auto auto auto 90px",
      }}
    >
      <input
        type="checkbox"
        aria-label={`Select ${lead.name}`}
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onSelect}
        className="accent-primary cursor-pointer"
      />
      <LeadAvatar name={lead.name} size={32} />
      <div className="min-w-0">
        <div className="font-semibold text-foreground truncate">{lead.name}</div>
        <div className="text-[11px] text-text-muted-2 truncate">{lead.email}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] text-foreground truncate">
          {lead.targetCampusAndProgram || (
            <span className="italic text-text-muted-2">Target belum diisi</span>
          )}
        </div>
        <div className="text-[11px] text-text-muted-2 truncate flex items-center gap-1.5 mt-0.5">
          {lead.parsedCountry && (
            <>
              <Icon name="globe" size={10} />
              <span className="truncate">{lead.parsedCountry}</span>
            </>
          )}
          {lead.fundingPlan && (
            <>
              <span className="opacity-40">·</span>
              <span className="truncate">{fundingPlanLabelId(lead.fundingPlan)}</span>
            </>
          )}
        </div>
      </div>
      <LeadBucketBadge bucket={lead.bucket} />
      <LeadStageBadge stage={lead.stage} />
      <EngagementIcons lead={lead} />
      <div className="flex flex-col items-end gap-[3px]">
        <ProgressDots done={progress.done} total={progress.total} />
        <div className="text-[10px] text-text-muted-2 tabular-nums">
          {progress.done}/{progress.total}
        </div>
      </div>
      <div
        className={`flex gap-1 justify-end transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}
      >
        <button
          type="button"
          title="Kirim email"
          onClick={(e) => {
            e.stopPropagation();
            onReachout("email");
          }}
          disabled={busy}
          className="w-7 h-7 rounded-md border border-border bg-surface text-text-muted hover:border-primary-200 hover:text-primary transition disabled:opacity-40 inline-flex items-center justify-center"
        >
          <Icon name="mail" size={13} />
        </button>
        <button
          type="button"
          title={hasWa ? "Kirim WhatsApp" : "Lead tanpa nomor WA"}
          onClick={(e) => {
            e.stopPropagation();
            if (hasWa) onReachout("whatsapp");
          }}
          disabled={busy || !hasWa}
          className="w-7 h-7 rounded-md border border-border bg-surface text-text-muted hover:border-primary-200 hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
        >
          <Icon name="chat" size={13} />
        </button>
        <button
          type="button"
          title="Schedule call"
          onClick={(e) => {
            e.stopPropagation();
            onScheduleCall();
          }}
          className="w-7 h-7 rounded-md border border-border bg-surface text-text-muted hover:border-primary-200 hover:text-primary transition inline-flex items-center justify-center"
        >
          <Icon name="calendar" size={13} />
        </button>
      </div>
    </div>
  );
}
