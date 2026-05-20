"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import LeadBucketBadge from "./LeadBucketBadge";
import {
  fundingPlanLabelId,
  type LeadEmailTemplate,
  type TemplateBucket,
  type LeadBucket,
} from "@/lib/leads/types";

interface Props {
  template: LeadEmailTemplate;
  /** Called with the freshly-saved template so the parent can re-fetch
   *  or merge into its cached list. */
  onSaved: (next: LeadEmailTemplate) => void;
}

/** Map TEMPLATE_BUCKETS → a representative LeadBucket for the badge. */
function pickBadgeBucket(b: TemplateBucket): LeadBucket {
  if (b === "A_B_C") return "A"; // teal-ish — represents the invitation cluster
  if (b === "D") return "D";
  if (b === "incomplete") return "incomplete";
  if (b === "domestic") return "domestic";
  return "unclassified";
}

/** Friendly title for each template card. */
function templateTitle(b: TemplateBucket): string {
  if (b === "A_B_C") return "Invitation (bucket A / B / C)";
  if (b === "D") return "Polite decline (bucket D — outside network)";
  if (b === "incomplete") return "Re-engagement (form belum lengkap)";
  if (b === "domestic") return "Domestic decline (target Indonesia)";
  return b;
}

/** Same token substitution rule as src/lib/email.ts. Duplicated here so
 *  the live preview doesn't need a server roundtrip. Keep in sync. */
function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? "");
}

const TOKENS = ["name", "campusJurusan", "fundingPlan"] as const;
type Token = (typeof TOKENS)[number];

const SAMPLE_DATA = {
  name: "Andi",
  campusJurusan: "Master of Business at Monash University",
  fundingPlan: fundingPlanLabelId("scholarship"),
};

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

export default function EmailTemplateEditor({ template, onSaved }: Props) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const dirty = subject !== template.subject || body !== template.body;

  const preview = useMemo(
    () => ({
      subject: substitute(subject, SAMPLE_DATA),
      body: substitute(body, SAMPLE_DATA),
    }),
    [subject, body],
  );

  /** Insert {{token}} at the textarea's caret position. */
  function insertToken(token: Token) {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((b) => b + `{{${token}}}`);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + `{{${token}}}` + body.slice(end);
    setBody(next);
    // Restore caret position after React re-renders.
    queueMicrotask(() => {
      const pos = start + `{{${token}}}`.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/new-leads/templates/${template.bucket}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || `HTTP ${res.status}`);
        return;
      }
      onSaved(json.template as LeadEmailTemplate);
      setOkMsg(`Tersimpan (v${json.template.version})`);
      setTimeout(() => setOkMsg(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setSubject(template.subject);
    setBody(template.body);
    setErr(null);
    setOkMsg(null);
  }

  return (
    <div className="card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LeadBucketBadge bucket={pickBadgeBucket(template.bucket as TemplateBucket)} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {templateTitle(template.bucket as TemplateBucket)}
            </h3>
            <p className="text-[11px] text-text-muted-2">
              Template <span className="font-mono">{template.bucket}</span> · v{template.version}
              {template.updatedAt && (
                <span> · updated {relativeTime(template.updatedAt)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && !saving && (
            <button type="button" onClick={revert} className="btn-ghost text-xs">
              Batalkan perubahan
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="check" size={12} />
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs px-3 py-2 rounded bg-danger-light border border-danger/30 text-danger">
          ⚠ {err}
        </div>
      )}
      {okMsg && (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
          {okMsg}
        </div>
      )}

      {/* Subject */}
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-text-muted-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-field text-sm"
        />
      </div>

      {/* Body + tokens */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Body (plain text)</label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-text-muted-2 uppercase tracking-wider">Insert:</span>
            {TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertToken(t)}
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-surface hover:border-primary-200 hover:text-primary transition"
              >
                {`{{${t}}}`}
              </button>
            ))}
          </div>
        </div>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          spellCheck={false}
          className="input-field text-xs font-mono leading-relaxed"
        />
      </div>

      {/* Live preview */}
      <div className="space-y-1 pt-2 border-t border-border/60">
        <div className="flex items-baseline justify-between">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Preview</label>
          <span className="text-[10px] text-text-muted-2 italic">
            sample: name=&ldquo;Andi&rdquo;, campusJurusan=&ldquo;Master of Business at Monash University&rdquo;
          </span>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-elevated/30 p-3 space-y-2">
          <div className="text-xs font-semibold text-foreground">{preview.subject}</div>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{preview.body}</pre>
        </div>
      </div>
    </div>
  );
}
