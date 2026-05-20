"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import EmailTemplateEditor from "@/components/admin/leads/EmailTemplateEditor";
import { TEMPLATE_BUCKETS, type LeadEmailTemplate } from "@/lib/leads/types";

interface ListResponse {
  templates: LeadEmailTemplate[];
}

/**
 * Email template editor surface — one card per LeadEmailTemplate row
 * (currently 4: A_B_C, D, incomplete, domestic). Admin can edit
 * subject + body, see live preview with sample data, and save. Each
 * save increments `version` and stamps `updatedBy` server-side.
 *
 * Send flow does NOT version-pin: OutreachLog snapshots subject+body
 * at send time, so the audit trail is intact.
 */
export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<LeadEmailTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/new-leads/templates", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as ListResponse;
      setTemplates(json.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  /** Merge the freshly-saved template into the cached list so we don't
   *  refetch the entire collection just to bump one version number. */
  function patchTemplate(next: LeadEmailTemplate) {
    setTemplates((prev) =>
      (prev ?? []).map((t) => (t.bucket === next.bucket ? next : t)),
    );
  }

  // Sort templates by TEMPLATE_BUCKETS order so the UI is deterministic
  // regardless of DB row order.
  const ordered = templates
    ? [...templates].sort(
        (a, b) => TEMPLATE_BUCKETS.indexOf(a.bucket) - TEMPLATE_BUCKETS.indexOf(b.bucket),
      )
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/dashboard/admin/new-leads"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground mb-2"
          >
            <Icon name="chevron-left" size={14} /> Semua leads
          </Link>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Email Templates
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Edit subject &amp; body untuk 4 template outreach. Token: <code className="font-mono">{`{{name}}`}</code>{" "}
            <code className="font-mono">{`{{campusJurusan}}`}</code>{" "}
            <code className="font-mono">{`{{fundingPlan}}`}</code>.
          </p>
        </div>
      </div>

      {/* Help banner */}
      <details className="card p-0 group/help">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground select-none">
          <span className="inline-flex items-center gap-2">
            <Icon name="lightbulb" size={14} className="text-primary" />
            Cara kerja template
          </span>
          <Icon name="chevron-right" size={14} className="text-text-muted-2 transition-transform group-open/help:rotate-90" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-2 text-xs text-text-muted">
          <p>
            Setiap lead masuk salah satu dari 4 bucket. Bucket → template:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>A / B / C</strong> → template <code className="font-mono">A_B_C</code> (invitation): kita bisa bantu — ada mentor atau partner kampus.</li>
            <li><strong>D</strong> → template <code className="font-mono">D</code> (polite decline): belum ada coverage region / kampus tertentu.</li>
            <li><strong>incomplete</strong> → template <code className="font-mono">incomplete</code> (re-engagement): form belum lengkap, minta lead isi info.</li>
            <li><strong>domestic</strong> → template <code className="font-mono">domestic</code> (decline): target studi di dalam negeri.</li>
            <li><strong>unclassified</strong> → tidak punya auto-template; admin override bucket dulu.</li>
          </ul>
          <p>
            <strong>Send-time snapshot:</strong> body+subject di-copy ke OutreachLog saat kirim. Edit setelah send tidak akan re-write log lama, jadi aman audit.
          </p>
        </div>
      </details>

      {loading ? (
        <SkeletonDashboard />
      ) : error ? (
        <div className="card p-6 text-sm text-danger">Error: {error}</div>
      ) : ordered.length === 0 ? (
        <div className="card p-6 text-sm text-text-muted">
          Tidak ada template terdaftar. Pastikan migration <code>_RUN-ALL-PENDING.sql</code> sudah dijalankan.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {ordered.map((t) => (
            <EmailTemplateEditor key={t.bucket} template={t} onSaved={patchTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}
