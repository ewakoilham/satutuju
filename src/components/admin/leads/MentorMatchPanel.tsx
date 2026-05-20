"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { Lead } from "@/lib/leads/types";

interface DbMentor {
  id: string;
  fullName: string;
  nickname: string;
  university: string;
  major: string;
  country: string;
  scholarship: string | null;
  isActive: boolean;
}

interface Props {
  lead: Lead;
  onChanged: () => void;
}

/**
 * Mentor Matching Panel — visible on lead detail when stage is at
 * `deposit_paid` (ready to be paired) or later. Surfaces:
 *   - Suggested mentors filtered by lead.parsedCountry
 *   - All-mentors searchable fallback
 *   - Confirm match button → POST /api/new-leads/[id]/match-mentor →
 *     writes Lead.mentorMatchedId + advances stage to `matched`
 *
 * After match, panel becomes read-only and shows the matched mentor.
 * Admin can still "Re-match" if there's a mistake.
 */
export default function MentorMatchPanel({ lead, onChanged }: Props) {
  const [mentors, setMentors] = useState<DbMentor[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(lead.mentorMatchedId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mentors", { credentials: "include", cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { mentors: DbMentor[] };
        setMentors(json.mentors.filter((m) => m.isActive));
      } catch {
        /* fail silently — admin can still type id manually */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Suggestions: same country first. Then field overlap (best-effort via
  // major substring). Then everyone else.
  const suggested = useMemo(() => {
    if (!mentors) return [];
    const targetCountry = lead.parsedCountry?.toLowerCase() ?? "";
    const targetField = (lead.parsedField ?? "").toLowerCase();
    return mentors
      .map((m) => {
        let score = 0;
        const country = m.country.toLowerCase();
        if (targetCountry && country === targetCountry) score += 10;
        if (targetField && targetField !== "unclear") {
          const major = m.major.toLowerCase();
          // STEM ~ technical-sounding majors; Business ~ business-y.
          if (targetField === "stem" && /engineer|computer|data|science|math|physics|biology|chemistry|tech/.test(major)) {
            score += 3;
          }
          if (targetField === "business" && /business|management|finance|economic|mba|policy|marketing/.test(major)) {
            score += 3;
          }
        }
        return { mentor: m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.mentor);
  }, [mentors, lead.parsedCountry, lead.parsedField]);

  const filtered = useMemo(() => {
    if (!mentors) return [];
    const q = search.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter((m) =>
      m.fullName.toLowerCase().includes(q) ||
      m.nickname.toLowerCase().includes(q) ||
      m.university.toLowerCase().includes(q) ||
      m.country.toLowerCase().includes(q) ||
      m.major.toLowerCase().includes(q),
    );
  }, [mentors, search]);

  const pickedMentor = mentors?.find((m) => m.id === pickedId) ?? null;

  async function confirmMatch() {
    if (!pickedId) return;
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/new-leads/${lead.id}/match-mentor`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId: pickedId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || `HTTP ${res.status}`);
        return;
      }
      setOkMsg(`Matched with ${pickedMentor?.fullName ?? pickedId} ✓ Stage → matched`);
      onChanged();
      setTimeout(() => setOkMsg(null), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!mentors) {
    return <div className="text-xs text-text-muted">Loading mentor list…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Current match (if any) */}
      {lead.mentorMatchedId && (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
          ✓ Currently matched with{" "}
          <strong>{mentors.find((m) => m.id === lead.mentorMatchedId)?.fullName ?? lead.mentorMatchedId}</strong>
        </div>
      )}

      {/* Suggested */}
      {suggested.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">
            Suggested mentors ({lead.parsedCountry ?? "any country"})
          </label>
          <ul className="space-y-1.5">
            {suggested.slice(0, 5).map((m) => (
              <MentorRow
                key={m.id}
                mentor={m}
                picked={m.id === pickedId}
                onPick={() => setPickedId(m.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* All mentors searchable */}
      <div className="space-y-2 pt-3 border-t border-border/60">
        <label className="text-xs uppercase tracking-wider text-text-muted-2">
          All mentors ({mentors.length})
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, university, country, major…"
          className="input-field text-sm"
        />
        <div className="max-h-64 overflow-y-auto border border-border/60 rounded-lg">
          <ul>
            {filtered.slice(0, 50).map((m) => (
              <MentorRow
                key={m.id}
                mentor={m}
                picked={m.id === pickedId}
                onPick={() => setPickedId(m.id)}
              />
            ))}
            {filtered.length === 0 && (
              <li className="text-xs text-text-muted px-3 py-4 text-center italic">No match for &ldquo;{search}&rdquo;</li>
            )}
          </ul>
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

      {/* Confirm */}
      <div className="pt-3 border-t border-border/60 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void confirmMatch()}
          disabled={busy || !pickedId || pickedId === lead.mentorMatchedId}
          className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="check" size={12} />
          {busy
            ? "Matching…"
            : !pickedId
            ? "Pilih mentor dulu"
            : pickedId === lead.mentorMatchedId
            ? "Sudah matched"
            : lead.mentorMatchedId
            ? "Re-match"
            : "Confirm match"}
        </button>
        {pickedMentor && pickedId !== lead.mentorMatchedId && (
          <span className="text-xs text-text-muted-2">
            Picked: <strong>{pickedMentor.nickname}</strong> · {pickedMentor.country}
          </span>
        )}
      </div>
    </div>
  );
}

function MentorRow({
  mentor,
  picked,
  onPick,
}: {
  mentor: DbMentor;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`w-full text-left px-3 py-2 text-xs flex items-baseline justify-between gap-2 transition border-b border-border/40 last:border-b-0 ${
          picked
            ? "bg-primary-50 border-l-2 border-l-primary"
            : "hover:bg-surface-elevated/40"
        }`}
      >
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{mentor.fullName}</div>
          <div className="text-[11px] text-text-muted-2 truncate">
            {mentor.university} · {mentor.major}
          </div>
        </div>
        <div className="text-[11px] text-text-muted-2 flex-shrink-0">
          {mentor.country}
        </div>
      </button>
    </li>
  );
}
