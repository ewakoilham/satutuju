"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import PipelineSubnav from "@/components/admin/leads/PipelineSubnav";
import { FUNDING_PLANS, fundingPlanLabelId, type FundingPlan } from "@/lib/leads/types";

/**
 * Manual lead entry. Same fields as the Tally form, plus auto-runs
 * classifyLead() on submit so the new lead lands with bucket / parsedCountry
 * / parsedField pre-filled.
 *
 * After successful create, redirects to /dashboard/admin/new-leads/[id]
 * so admin can immediately review classification + take action.
 */
export default function NewLeadPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [target, setTarget] = useState("");
  const [fundingPlan, setFundingPlan] = useState<FundingPlan>("scholarship");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = name.trim() && email.includes("@") && fundingPlan;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/new-leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          whatsappNumber: whatsapp.trim() || null,
          targetCampusAndProgram: target.trim(),
          fundingPlan,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || `HTTP ${res.status}`);
        return;
      }
      // Redirect to the new lead's detail page so admin can review
      // classification immediately.
      router.push(`/dashboard/admin/new-leads/${json.lead.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PipelineSubnav />
      <div>
        <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
          Tambah Lead Manual
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Buat lead bypass Tally — mis. referral dari mentor, organic DM, in-person inquiry.
          Classifier akan jalan otomatis pada submit.
        </p>
      </div>

      <form onSubmit={submit} className="card p-5 space-y-4 max-w-xl">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Nama lengkap *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input-field text-sm"
            placeholder="mis. Andi Pratama"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field text-sm"
            placeholder="andi@example.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">WhatsApp (opsional)</label>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="input-field text-sm font-mono"
            placeholder="6281234567890"
          />
          <p className="text-[11px] text-text-muted-2">Format internasional (62...) atau 08... — sistem auto-convert ke wa.me URL.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Target kampus & program</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="input-field text-sm"
            placeholder="mis. Master of Business at Monash University, Australia"
          />
          <p className="text-[11px] text-text-muted-2">
            Kosong = bucket <code className="font-mono">incomplete</code> (re-engage email).
            Sebutkan kampus + negara untuk auto-classify ke bucket A/B/C/D.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Funding plan *</label>
          <select
            value={fundingPlan}
            onChange={(e) => setFundingPlan(e.target.value as FundingPlan)}
            required
            className="input-field text-sm"
          >
            {FUNDING_PLANS.map((f) => (
              <option key={f} value={f}>{fundingPlanLabelId(f)}</option>
            ))}
          </select>
        </div>

        {err && (
          <div className="text-xs px-3 py-2 rounded bg-danger-light border border-danger/30 text-danger">
            ⚠ {err}
          </div>
        )}

        <div className="pt-2 border-t border-border/60 flex items-center gap-2">
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {busy ? "Membuat…" : "Buat lead + classify"}
          </button>
          <Link href="/dashboard/admin/new-leads" className="btn-ghost text-sm">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
