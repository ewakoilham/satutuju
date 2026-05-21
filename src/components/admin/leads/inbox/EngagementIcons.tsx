import Icon from "@/components/ui/Icon";
import type { Lead } from "@/lib/leads/types";

/**
 * Per-channel engagement icon row. Shows email + WA state side by side
 * with progressive color intensity:
 *
 *   Email: gray (none) → slate (sent) → blue (opened) → indigo (clicked)
 *   WA:    gray (none) → slate (sent) → emerald (read)
 *
 * Hover for exact timestamp.
 */

interface Props {
  lead: Lead;
  size?: number;
}

export default function EngagementIcons({ lead, size = 13 }: Props) {
  const emailSent = lead.outreachSentAt !== null;
  const emailOpened = lead.emailOpenedAt !== null;
  const emailClicked = lead.emailClickedAt !== null;
  const waSent = lead.whatsappSentAt !== null;
  const waRead = lead.whatsappReadAt !== null;

  const emailColor = emailClicked
    ? "text-indigo-600"
    : emailOpened
      ? "text-blue-600"
      : emailSent
        ? "text-slate-500"
        : "text-slate-300";
  const emailTitle = emailClicked
    ? `Email diklik · ${lead.emailClickedAt}`
    : emailOpened
      ? `Email dibuka · ${lead.emailOpenedAt}`
      : emailSent
        ? `Email terkirim · ${lead.outreachSentAt}`
        : "Email belum dikirim";

  const waColor = waRead
    ? "text-emerald-600"
    : waSent
      ? "text-slate-500"
      : "text-slate-300";
  const waTitle = waRead
    ? `WA dibaca · ${lead.whatsappReadAt}`
    : waSent
      ? `WA terkirim · ${lead.whatsappSentAt}`
      : "WA belum dikirim";

  return (
    <div className="flex items-center gap-2 text-text-muted-2">
      <span title={emailTitle} className={emailColor}>
        <Icon name={emailClicked ? "click" : emailOpened ? "eye" : "mail"} size={size} />
      </span>
      <span title={waTitle} className={waColor}>
        <Icon name="chat" size={size} />
      </span>
    </div>
  );
}
