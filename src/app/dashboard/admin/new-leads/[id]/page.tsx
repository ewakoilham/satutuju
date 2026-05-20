"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import PipelineChecklist from "@/components/admin/leads/PipelineChecklist";
import OutreachPanel from "@/components/admin/leads/OutreachPanel";
import CallPanel from "@/components/admin/leads/CallPanel";
import MentorMatchPanel from "@/components/admin/leads/MentorMatchPanel";
import {
  CALL_PANEL_STAGES,
  type Lead,
  type LeadStageHistory,
  type OutreachLog,
  type LeadStepDefinition,
  type LeadStepStatusRow,
  fundingPlanLabelId,
} from "@/lib/leads/types";

interface DetailResponse {
  lead: Lead;
  history: LeadStageHistory[];
  outreach: OutreachLog[];
  steps: LeadStepDefinition[];
  statuses: LeadStepStatusRow[];
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min}m yang lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j yang lalu`;
  const d = Math.floor(hr / 24);
  return `${d}h yang lalu`;
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/new-leads/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as DetailResponse);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return <SkeletonDashboard />;
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/admin/new-leads" className="btn-ghost inline-flex items-center gap-1.5 text-sm">
          <Icon name="chevron-left" size={14} /> Kembali
        </Link>
        <div className="card p-6 text-sm text-danger">{error || "Lead tidak ditemukan"}</div>
      </div>
    );
  }

  const { lead, history, outreach, steps, statuses } = data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/dashboard/admin/new-leads" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-2">
            <Icon name="chevron-left" size={14} /> Semua leads
          </Link>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
              {lead.name}
            </h1>
            <LeadBucketBadge bucket={lead.bucket} />
            <LeadStageBadge stage={lead.stage} />
          </div>
          <p className="text-sm text-text-muted mt-1">
            <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a>
            {lead.whatsappNumber && (
              <span> · WA: <span className="font-mono">{lead.whatsappNumber}</span></span>
            )}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_minmax(0,360px)] gap-5 items-start">
        {/* Main column */}
        <div className="space-y-5">
          {/* Lead info card */}
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Info Lead</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-text-muted-2 text-xs">Target kampus / program</dt>
                <dd className="text-foreground mt-0.5">{lead.targetCampusAndProgram}</dd>
              </div>
              <div>
                <dt className="text-text-muted-2 text-xs">Rencana pendanaan</dt>
                <dd className="text-foreground mt-0.5">{fundingPlanLabelId(lead.fundingPlan)}</dd>
              </div>
              <div>
                <dt className="text-text-muted-2 text-xs">Submitted</dt>
                <dd className="text-foreground mt-0.5">{formatStamp(lead.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-text-muted-2 text-xs">Last updated</dt>
                <dd className="text-foreground mt-0.5">{relativeTime(lead.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Classification */}
          <section className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Klasifikasi</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <LeadBucketBadge bucket={lead.bucket} />
              <span className="text-text-muted">·</span>
              <span className="text-foreground">{lead.parsedCountry ?? "Country unclear"}</span>
              {lead.parsedCampus && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-foreground">{lead.parsedCampus}</span>
                </>
              )}
              {lead.parsedField && lead.parsedField !== "unclear" && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-foreground">field: {lead.parsedField}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>Mentor in country: <strong>{lead.hasCountryMentor ? "yes" : "no"}</strong></span>
              <span>Campus is partner: <strong>{lead.isCampusPartner === null ? "?" : lead.isCampusPartner ? "yes" : "no"}</strong></span>
            </div>
            {lead.bucketReason && (
              <p className="text-xs text-text-muted-2 italic">{lead.bucketReason}</p>
            )}
          </section>

          {/* Pipeline Checklist */}
          <section className="card p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Pipeline Checklist</h2>
              <Link href="/dashboard/admin/new-leads/pipeline" className="text-xs text-primary hover:underline">
                Manage steps →
              </Link>
            </div>
            <PipelineChecklist
              leadId={lead.id}
              steps={steps}
              statuses={statuses}
              onChanged={fetchDetail}
            />
          </section>

          {/* Outreach Email */}
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Outreach Email</h2>
            <OutreachPanel
              lead={lead}
              outreach={outreach}
              onChanged={fetchDetail}
              variant="full"
            />
          </section>

          {/* Call Panel — gated by CALL_PANEL_STAGES inside the component.
              Section header would still render for irrelevant stages, so
              we mirror the guard here to hide the wrapper too. */}
          {CALL_PANEL_STAGES.includes(lead.stage) && (
            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Call Panel</h2>
              <CallPanel lead={lead} onChanged={fetchDetail} />
            </section>
          )}

          {/* Mentor Matching — visible when stage = deposit_paid (ready
              to pair) or already matched (so admin can re-match). */}
          {(lead.stage === "deposit_paid" || lead.stage === "matched") && (
            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Mentor Matching</h2>
              <MentorMatchPanel lead={lead} onChanged={fetchDetail} />
            </section>
          )}
        </div>

        {/* Sidebar: Stage Timeline */}
        <aside className="card p-5 space-y-3 lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">Stage Timeline</h2>
          {history.length === 0 ? (
            <p className="text-xs text-text-muted">No transitions yet</p>
          ) : (
            <ol className="space-y-3 relative">
              {history.map((h, i) => (
                <li key={h.id} className="pl-5 relative">
                  <span
                    className={`absolute left-0 top-1 w-2 h-2 rounded-full ${
                      i === 0 ? "bg-primary" : "bg-text-muted-2"
                    }`}
                    aria-hidden
                  />
                  {i < history.length - 1 && (
                    <span className="absolute left-[3px] top-3 bottom-0 w-0.5 bg-border" aria-hidden />
                  )}
                  <div className="text-xs font-medium text-foreground">
                    {h.fromStage ? `${h.fromStage} → ${h.toStage}` : h.toStage}
                  </div>
                  <div className="text-[11px] text-text-muted-2">
                    {formatStamp(h.createdAt)} · {h.changedBy}
                  </div>
                  {h.note && (
                    <div className="text-[11px] text-text-muted mt-0.5 italic line-clamp-3">{h.note}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
