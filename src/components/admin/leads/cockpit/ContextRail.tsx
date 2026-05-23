"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import LeadAvatar from "@/components/admin/leads/inbox/LeadAvatar";
import {
  fundingPlanLabelId,
  type Lead,
  type LeadStageHistory,
  type OutreachLog,
} from "@/lib/leads/types";
import { formatJakartaRelativeShort } from "@/lib/datetime-id";

/**
 * Left rail of the Call Cockpit — always-glanceable context that the
 * admin doesn't need to scroll through during the call. Five stacked
 * sections:
 *   1. Lead head: avatar + name + bucket + stage + contact
 *   2. Target studi: campus/program + pills (country, funding)
 *   3. Klasifikasi: bucket + checklines for mentor / partner status
 *   4. Engagement: mini timeline of recent activity (5 newest events)
 *   5. Mentor kandidat: top 3 by country match
 */

interface MentorLite {
  id: string;
  fullName: string;
  nickname?: string | null;
  country?: string | null;
  university?: string | null;
  major?: string | null;
}

interface Props {
  lead: Lead;
  history: LeadStageHistory[];
  outreach: OutreachLog[];
}

const relativeTime = formatJakartaRelativeShort;

export default function ContextRail({ lead, history, outreach }: Props) {
  const [mentors, setMentors] = useState<MentorLite[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);

  // Fetch mentors and pick top 3 by country match with the lead.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentors", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const all: MentorLite[] = j.mentors ?? j ?? [];
        const country = lead.parsedCountry;
        const ranked = all.slice().sort((a, b) => {
          const ascore = a.country === country ? 1 : 0;
          const bscore = b.country === country ? 1 : 0;
          return bscore - ascore;
        });
        setMentors(ranked.slice(0, 3));
        setLoadingMentors(false);
      })
      .catch(() => !cancelled && setLoadingMentors(false));
    return () => {
      cancelled = true;
    };
  }, [lead.parsedCountry]);

  // Build engagement timeline from outreach + stage history merged.
  const engagement: Array<{ icon: string; color: string; text: string; when: string }> = [];
  if (lead.emailClickedAt) {
    engagement.push({ icon: "click", color: "text-indigo-600", text: "Email diklik (link booking)", when: relativeTime(lead.emailClickedAt) });
  }
  if (lead.emailOpenedAt) {
    engagement.push({ icon: "eye", color: "text-blue-600", text: "Email dibuka", when: relativeTime(lead.emailOpenedAt) });
  }
  if (lead.whatsappReadAt) {
    engagement.push({ icon: "chat", color: "text-emerald-600", text: "WA dibaca", when: relativeTime(lead.whatsappReadAt) });
  }
  if (outreach[0]) {
    engagement.push({ icon: "send", color: "text-slate-500", text: `${outreach[0].channel === "whatsapp" ? "WA" : "Email"} terkirim`, when: relativeTime(outreach[0].sentAt) });
  }
  engagement.push({ icon: "inbox", color: "text-slate-500", text: "Form Tally diterima", when: relativeTime(lead.submittedAt) });

  function matchPct(m: MentorLite): number {
    const countryHit = m.country === lead.parsedCountry;
    const fieldHit = lead.parsedField && m.major?.toLowerCase().includes(lead.parsedField.toLowerCase());
    if (countryHit && fieldHit) return 96;
    if (countryHit) return 88;
    if (fieldHit) return 64;
    return 42;
  }

  // Avoid 'unused' lint warning until we wire history into a section.
  void history;

  return (
    <aside className="w-[280px] flex-shrink-0 self-start bg-surface border border-border rounded-xl overflow-hidden">
      {/* Lead head */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-3 items-center">
          <LeadAvatar name={lead.name} size={44} />
          <div className="min-w-0">
            <div className="font-bold text-[15px] text-foreground font-[family-name:var(--font-heading)] truncate">
              {lead.name}
            </div>
            <div className="flex gap-1.5 mt-1">
              <LeadBucketBadge bucket={lead.bucket} />
              <LeadStageBadge stage={lead.stage} />
            </div>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-text-muted flex flex-col gap-1.5">
          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-primary truncate">
            <Icon name="mail" size={12} />
            <span className="truncate">{lead.email}</span>
          </a>
          {lead.whatsappNumber && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="chat" size={12} />
              <span className="font-mono text-[11px]">{lead.whatsappNumber}</span>
            </span>
          )}
        </div>
      </div>

      <Section title="Target studi">
        <div className="text-[13px] font-semibold text-foreground leading-snug">
          {lead.targetCampusAndProgram || (
            <span className="font-normal italic text-text-muted-2">Belum diisi</span>
          )}
        </div>
        {lead.parsedField && lead.parsedField !== "unclear" && (
          <div className="text-[12px] text-text-muted mt-0.5">Field: {lead.parsedField}</div>
        )}
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {lead.parsedCountry && <Pill icon="globe">{lead.parsedCountry}</Pill>}
          <Pill icon="tag">{fundingPlanLabelId(lead.fundingPlan)}</Pill>
        </div>
      </Section>

      <Section title="Klasifikasi">
        <div className="flex gap-2 items-center mb-2">
          <LeadBucketBadge bucket={lead.bucket} />
          <span className="text-[12px] text-foreground font-medium">{bucketDesc(lead.bucket)}</span>
        </div>
        <CheckLine on={lead.hasCountryMentor}>
          Mentor di {lead.parsedCountry || "negara tujuan"}
        </CheckLine>
        <CheckLine on={lead.isCampusPartner === true}>
          {lead.parsedCampus || "Kampus tujuan"} = partner
        </CheckLine>
        {/* Phase 12: program-scope restriction. Visible only when the
            partner accepts a narrow program (e.g. Cocoro = English
            Language). Amber to catch admin's eye — committing a lead
            outside this scope means zero commission for Satu Tuju. */}
        {lead.isCampusPartner === true && lead.partnerProgramScope && (
          <div
            className="mt-1.5 inline-flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-2 py-1 leading-snug"
            title="Komisi hanya berlaku kalau program lead match dengan scope ini. Verifikasi manual saat call — kalau lead minta program di luar scope, perlakukan sebagai non-partner."
          >
            <Icon name="flag" size={12} className="mt-0.5 text-amber-700 flex-shrink-0" />
            <span>
              Partner kampus <strong className="font-semibold">hanya untuk: {lead.partnerProgramScope}</strong>
              <span className="block text-[10px] text-amber-800/80 italic">
                Verifikasi program lead saat call · komisi cuma berlaku kalau match
              </span>
            </span>
          </div>
        )}
      </Section>

      <Section title="Engagement">
        {engagement.length === 0 ? (
          <div className="text-[12px] text-text-muted-2 italic">Belum ada aktivitas.</div>
        ) : (
          <div className="space-y-1.5">
            {engagement.slice(0, 5).map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-[11.5px]">
                <span className={it.color}>
                  <Icon name={it.icon} size={12} />
                </span>
                <span className="flex-1 truncate text-foreground">{it.text}</span>
                <span className="text-text-muted-2 text-[10.5px]">{it.when}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Mentor kandidat (top 3)">
        {loadingMentors ? (
          <div className="text-[12px] text-text-muted-2">Loading…</div>
        ) : mentors.length === 0 ? (
          <div className="text-[12px] text-text-muted-2 italic">Tidak ada kandidat.</div>
        ) : (
          <div className="space-y-2">
            {mentors.map((m) => {
              const pct = matchPct(m);
              const pillBg = pct >= 90
                ? "bg-emerald-100 text-emerald-800"
                : pct >= 70
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-100 text-slate-700";
              const displayName = m.nickname || m.fullName;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border/60"
                >
                  <LeadAvatar name={displayName} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">
                      {displayName}
                    </div>
                    <div className="text-[10.5px] text-text-muted-2 truncate">
                      {m.university}{m.major ? ` · ${m.major}` : ""}
                    </div>
                  </div>
                  <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded tabular-nums ${pillBg}`}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-t border-border/60">
      <div className="text-[10.5px] font-semibold text-text-muted-2 uppercase tracking-[0.06em] mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function Pill({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated/60 text-[11px] font-medium text-foreground">
      <Icon name={icon} size={11} />
      {children}
    </span>
  );
}

function CheckLine({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-text-muted mt-1">
      <span className={on ? "text-emerald-600" : "text-rose-600"}>
        <Icon name={on ? "check" : "x"} size={12} />
      </span>
      {children}
    </div>
  );
}

function bucketDesc(bucket: string): string {
  switch (bucket) {
    case "A": return "Mentor + partner kampus";
    case "B": return "Hanya mentor";
    case "C": return "Hanya partner kampus";
    case "D": return "Tidak ada keduanya";
    case "incomplete": return "Form belum lengkap";
    case "domestic": return "Target dalam negeri";
    default: return "Perlu review";
  }
}
