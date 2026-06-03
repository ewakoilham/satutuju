"use client";

/** Rencana Sesi — session planner for a newly-paired mentee.
 *
 *  Mentor lands here from the Mentee tab "Susun rencana sesi →" CTA on
 *  any "baru match" pairing. Loads the SessionPlan from the API (seeds
 *  with a default 10-session template on first visit), lets mentor:
 *    - rename each session inline (contenteditable)
 *    - reorder rows by HTML5 drag-and-drop
 *    - cycle phase via pill click
 *    - cycle duration via pill click
 *    - duplicate / delete rows
 *    - add new rows (max 15)
 *  ...and either save the draft or finalize + notify the mentee.
 *
 *  Auto-save runs in the background (1.5s debounce). Explicit "Simpan
 *  draft" forces an immediate flush + status toast. */

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import {
  PLAN_MAX_SESSIONS,
  PLAN_MIN_SESSIONS,
  PLAN_MIN_DURATION,
  PLAN_MAX_DURATION,
  PLAN_PHASES,
  type SessionPlanRow,
  planTotalMinutes,
} from "@/lib/session-plan-defaults";

interface PairingInfo {
  id: string;
  mentor: { id: string; name: string };
  mentee: { id: string; name: string; email: string };
  targetProgram?: string | null;
  menteeProfile?: {
    intendedStudyProgram?: string;
    preferredDestinations?: string;
  } | null;
}

interface PlanRecord {
  id: string;
  pairingId: string;
  status: "draft" | "finalized" | "acknowledged";
  rows: SessionPlanRow[];
  finalizedAt: string | null;
  acknowledgedAt: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function RencanaSesiPage({ params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = use(params);
  const router = useRouter();

  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // First-time "how to use the planner" nudge. Read from localStorage in an
  // effect (not at init) to avoid an SSR/hydration mismatch.
  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("rencana-nudge-dismissed") !== "1") setShowNudge(true);
    } catch { /* ignore */ }
  }, []);
  function dismissNudge() {
    setShowNudge(false);
    try { localStorage.setItem("rencana-nudge-dismissed", "1"); } catch { /* ignore */ }
  }

  // Which session row has its detail panel expanded (one at a time).
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);

  // Drag state — index of the row being dragged.
  const dragIdx = useRef<number | null>(null);

  // Load pairing + plan in parallel on mount.
  useEffect(() => {
    Promise.all([
      fetch(`/api/pairings`).then((r) => r.json()),
      fetch(`/api/session-plans/${pairingId}`).then((r) => r.json()),
    ])
      .then(([pairingsResp, planResp]) => {
        const p = (pairingsResp.pairings || []).find((x: PairingInfo) => x.id === pairingId);
        if (!p) {
          setErr("Pairing tidak ditemukan atau kamu tidak punya akses.");
          return;
        }
        if (planResp.error) {
          setErr(planResp.error);
          return;
        }
        setPairing(p);
        setPlan(planResp.plan);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [pairingId]);

  /** Persist plan.rows to the server. Returns the saved plan on success. */
  const saveRows = useCallback(
    async (rows: SessionPlanRow[]): Promise<void> => {
      if (!plan) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/session-plans/${pairingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        if (!res.ok) {
          const data = await res.json();
          setErr(data.error || "Gagal menyimpan rencana.");
          setSaveState("error");
          return;
        }
        setSaveState("saved");
      } catch (e) {
        console.error(e);
        setSaveState("error");
      }
    },
    [plan, pairingId],
  );

  // Debounced auto-save: 1.5s after the last mutation.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSave(rows: SessionPlanRow[]) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => saveRows(rows), 1500);
  }

  /** Wraps every mutation: updates local state + schedules a save. */
  function mutate(updater: (cur: SessionPlanRow[]) => SessionPlanRow[]) {
    if (!plan) return;
    const next = updater(plan.rows).map((r, i) => ({ ...r, order: i + 1 }));
    setPlan({ ...plan, rows: next });
    scheduleSave(next);
  }

  function renameRow(id: string, title: string) {
    mutate((rows) => rows.map((r) => (r.id === id ? { ...r, title: title.trim() || "Sesi tanpa nama" } : r)));
  }
  function cyclePhase(id: string) {
    mutate((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const i = PLAN_PHASES.indexOf(r.phase);
        return { ...r, phase: PLAN_PHASES[(i + 1) % PLAN_PHASES.length] };
      }),
    );
  }
  /** Free-entry duration (minutes), clamped to the allowed range. */
  function setDuration(id: string, minutes: number) {
    const n = Math.max(PLAN_MIN_DURATION, Math.min(PLAN_MAX_DURATION, Math.round(minutes)));
    mutate((rows) => rows.map((r) => (r.id === id ? { ...r, durationMinutes: n } : r)));
  }
  function duplicateRow(id: string) {
    mutate((rows) => {
      if (rows.length >= PLAN_MAX_SESSIONS) return rows;
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return rows;
      const src = rows[idx];
      const clone: SessionPlanRow = {
        ...src,
        id: randomId(),
        title: `${src.title} (salinan)`,
      };
      const out = [...rows];
      out.splice(idx + 1, 0, clone);
      return out;
    });
  }
  function deleteRow(id: string) {
    mutate((rows) => {
      if (rows.length <= PLAN_MIN_SESSIONS) return rows;
      return rows.filter((r) => r.id !== id);
    });
  }
  /** Move a row one step up (dir=-1) or down (dir=+1) — easier than drag. */
  function moveRow(id: string, dir: -1 | 1) {
    mutate((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      const to = idx + dir;
      if (idx === -1 || to < 0 || to >= rows.length) return rows;
      const out = [...rows];
      const [m] = out.splice(idx, 1);
      out.splice(to, 0, m);
      return out;
    });
  }
  function addRow() {
    mutate((rows) => {
      if (rows.length >= PLAN_MAX_SESSIONS) return rows;
      return [
        ...rows,
        {
          id: randomId(),
          order: rows.length + 1,
          title: "Sesi baru",
          phase: "Writing",
          durationMinutes: 75,
        },
      ];
    });
  }

  // ── Drag handlers ───────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, idx: number) {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) return;
    mutate((rows) => {
      const out = [...rows];
      const [moved] = out.splice(from, 1);
      out.splice(dropIdx, 0, moved);
      return out;
    });
    dragIdx.current = null;
  }

  async function flushSaveNow(): Promise<void> {
    if (!plan) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await saveRows(plan.rows);
  }

  async function handleFinalize() {
    if (!plan) return;
    setFinalizing(true);
    setErr(null);
    try {
      // Flush any pending debounce first.
      await flushSaveNow();
      const res = await fetch(`/api/session-plans/${pairingId}/finalize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Gagal finalisasi.");
        return;
      }
      // Update local state then redirect.
      setPlan({ ...plan, status: "finalized", finalizedAt: new Date().toISOString() });
      setConfirmFinalize(false);
      router.push("/dashboard/mentee");
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (err && !plan) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h1 className="sesi-title">Tidak bisa membuka rencana sesi.</h1>
        <p className="sesi-sub" style={{ margin: "12px auto 24px" }}>{err}</p>
        <Link href="/dashboard/mentee" className="db-btn db-btn-outline sm">← Kembali ke Mentee</Link>
      </div>
    );
  }
  if (!pairing || !plan) return null;

  const total = plan.rows.length;
  const totalMin = planTotalMinutes(plan.rows);
  const totalHoursLabel = `${(totalMin / 60).toFixed(1).replace(".0", "")} jam`;
  const monthsLabel = `~${Math.max(1, Math.round(total / 4))} bulan`;
  const isFinalized = plan.status !== "draft";
  const canDelete = total > PLAN_MIN_SESSIONS;
  const canAdd = total < PLAN_MAX_SESSIONS;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">
            <Link href="/dashboard/mentee">Mentee</Link>
            {" › "}
            <span>{pairing.mentee.name}</span>
            {" › "}
            <span style={{ color: "var(--text-muted)" }}>Rencana sesi</span>
          </div>
          <h1 className="sesi-title">
            Susun rencana sesi <span className="lede">— bareng {pairing.mentee.name.split(/\s+/)[0]}.</span>
          </h1>
          <p className="sesi-sub">
            Mulai dari saran kurikulum {PLAN_MIN_SESSIONS}–{PLAN_MAX_SESSIONS} sesi Satu Tuju. Edit judul, atur ulang urutan,
            hapus atau tambah sesi (minimum {PLAN_MIN_SESSIONS}). Finalisasi setelah {pairing.mentee.name.split(/\s+/)[0]} setuju.
          </p>
        </div>
      </div>

      <div className="rs-status-row">
        {isFinalized ? (
          <span className="rs-status-pill rs-status-final">
            <span className="rs-status-dot" /> SUDAH DI-FINALISASI · {new Date(plan.finalizedAt!).toLocaleDateString("id-ID")}
          </span>
        ) : (
          <span className="rs-status-pill rs-status-draft">
            <span className="rs-status-dot" /> DRAFT · BELUM DI-FINALISASI
          </span>
        )}
        <span className="rs-save-state" aria-live="polite">
          {saveState === "saving" && "Menyimpan…"}
          {saveState === "saved" && "Tersimpan otomatis"}
          {saveState === "error" && "Gagal simpan — coba lagi"}
        </span>
      </div>

      {/* Mentee context */}
      <div className="rs-ctx">
        <div className="av-grad lg av-c6">{initials(pairing.mentee.name)}</div>
        <div className="info">
          <h2>{pairing.mentee.name}</h2>
          <div className="meta">
            {(pairing.menteeProfile?.intendedStudyProgram || pairing.targetProgram) && (
              <>
                <span>Target: <b>{pairing.menteeProfile?.intendedStudyProgram || pairing.targetProgram}</b></span>
                <span className="dot" />
              </>
            )}
            {pairing.menteeProfile?.preferredDestinations && (
              <>
                <span>{pairing.menteeProfile.preferredDestinations}</span>
                <span className="dot" />
              </>
            )}
            <span>{pairing.mentee.email}</span>
          </div>
        </div>
        <div className="right">
          <div className="ttl">total sesi</div>
          <div className="cnt">{total}</div>
          <div className="min-note">minimal {PLAN_MIN_SESSIONS}</div>
        </div>
      </div>

      <div className="rs-split">
        <div className="rs-main">
          <div className="rs-toolbar">
            <h2>Rencana sesi</h2>
            <span className="rs-source-tag">★ Saran Satu Tuju</span>
          </div>

          {showNudge && !isFinalized && (
            <div className="rs-nudge" role="note">
              <span className="rs-nudge-icon" aria-hidden="true">💡</span>
              <div className="rs-nudge-body">
                <strong>Cara menyusun rencana sesi</strong>
                <ul>
                  <li>Pakai tombol <b>↑ / ↓</b> (atau tarik ikon ⠿) untuk mengurutkan ulang sesi.</li>
                  <li><b>Klik judul</b> sesi untuk mengganti namanya.</li>
                  <li><b>Klik pil fase</b> untuk ganti fase, dan <b>ketik angka durasi</b> (menit).</li>
                  <li>Pakai ikon <b>salin</b> / <b>hapus</b> di kanan tiap baris (minimal {PLAN_MIN_SESSIONS} sesi).</li>
                  <li>Klik ikon <b>ⓘ</b> di kanan untuk lihat detail tiap sesi (tujuan &amp; persiapan).</li>
                  <li>Kalau sudah pas, tekan <b>Finalisasi &amp; kirim</b> — mentee otomatis dapat email.</li>
                </ul>
              </div>
              <button type="button" className="rs-nudge-close" onClick={dismissNudge} aria-label="Tutup tips">✕</button>
            </div>
          )}

          {err && (
            <div className="rs-error">{err}</div>
          )}

          <div className="rs-list">
            {plan.rows.map((row, i) => (
              <div
                key={row.id}
                className="rs-row"
                draggable={!isFinalized}
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, i)}
              >
                <span className="rs-grip" title="Tarik untuk atur ulang" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" />
                    <circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />
                  </svg>
                </span>
                <span className="rs-num">{row.order}</span>
                <div className="rs-info">
                  <h3
                    className="rs-title"
                    contentEditable={!isFinalized}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={(e) => renameRow(row.id, e.currentTarget.textContent || "")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).blur();
                      }
                    }}
                  >
                    {row.title}
                  </h3>
                  <div className="rs-meta">
                    <button
                      type="button"
                      className="rs-phase"
                      data-phase={row.phase}
                      onClick={() => !isFinalized && cyclePhase(row.id)}
                      disabled={isFinalized}
                      title={isFinalized ? "Fase tidak bisa diubah setelah finalisasi" : "Klik untuk ganti fase"}
                    >
                      {row.phase}
                    </button>
                    <span className="rs-dur" title={isFinalized ? "Durasi tidak bisa diubah setelah finalisasi" : "Ketik durasi dalam menit"}>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="rs-dur-input"
                        defaultValue={row.durationMinutes}
                        min={PLAN_MIN_DURATION}
                        max={PLAN_MAX_DURATION}
                        step={5}
                        disabled={isFinalized}
                        aria-label="Durasi sesi (menit)"
                        onBlur={(e) => {
                          const raw = parseInt(e.currentTarget.value, 10);
                          const n = Math.max(PLAN_MIN_DURATION, Math.min(PLAN_MAX_DURATION, isNaN(raw) ? row.durationMinutes : raw));
                          e.currentTarget.value = String(n);
                          if (n !== row.durationMinutes) setDuration(row.id, n);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                      />
                      <span className="rs-dur-unit">mnt</span>
                    </span>
                  </div>
                </div>
                <div className="rs-actions">
                  <div className="rs-move">
                    <button
                      type="button"
                      className="rs-iconbtn rs-movebtn"
                      title="Naikkan sesi"
                      aria-label="Naikkan sesi"
                      onClick={() => moveRow(row.id, -1)}
                      disabled={isFinalized || i === 0}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rs-iconbtn rs-movebtn"
                      title="Turunkan sesi"
                      aria-label="Turunkan sesi"
                      onClick={() => moveRow(row.id, 1)}
                      disabled={isFinalized || i === plan.rows.length - 1}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`rs-iconbtn rs-detailbtn${openDetailId === row.id ? " is-open" : ""}`}
                    title="Detail sesi — apa yang dibahas & disiapkan"
                    aria-expanded={openDetailId === row.id}
                    onClick={() => setOpenDetailId((cur) => (cur === row.id ? null : row.id))}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="rs-iconbtn"
                    title="Duplikat"
                    onClick={() => duplicateRow(row.id)}
                    disabled={isFinalized || !canAdd}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="rs-iconbtn rs-iconbtn-danger"
                    title="Hapus"
                    onClick={() => deleteRow(row.id)}
                    disabled={isFinalized || !canDelete}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                    </svg>
                  </button>
                </div>

                {openDetailId === row.id && (
                  <div className="rs-detail-panel">
                    {row.objective ? (
                      <>
                        <div className="rs-detail-obj">
                          <span className="rs-detail-label">Tujuan sesi</span>
                          <p>{row.objective}</p>
                        </div>
                        <div className="rs-detail-cols">
                          {row.deliverables?.length ? (
                            <div>
                              <span className="rs-detail-label">Hasil / output</span>
                              <ul>{row.deliverables.map((d, k) => <li key={k}>{d}</li>)}</ul>
                            </div>
                          ) : null}
                          {row.menteePrep?.length ? (
                            <div>
                              <span className="rs-detail-label">Disiapkan mentee</span>
                              <ul>{row.menteePrep.map((d, k) => <li key={k}>{d}</li>)}</ul>
                            </div>
                          ) : null}
                          {row.mentorPrep?.length ? (
                            <div>
                              <span className="rs-detail-label">Disiapkan mentor</span>
                              <ul>{row.mentorPrep.map((d, k) => <li key={k}>{d}</li>)}</ul>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="rs-detail-empty">
                        Sesi kustom — belum ada detail kurikulum. Tujuan & persiapan bisa kamu
                        sampaikan langsung ke mentee saat sesi.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!isFinalized && (
            <button type="button" className="rs-add" onClick={addRow} disabled={!canAdd}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              {canAdd ? "Tambah sesi baru" : `Sudah di maksimum (${PLAN_MAX_SESSIONS})`}
            </button>
          )}

          {!canDelete && !isFinalized && (
            <div className="rs-min-warn">
              <strong>Minimum {PLAN_MIN_SESSIONS} sesi.</strong> Saat ini ada {total} sesi —
              tombol hapus dimatikan. Tambah sesi baru kalau perlu fleksibilitas, atau lanjut finalisasi.
            </div>
          )}

          {/* Footer summary + finalize */}
          <div className="rs-foot">
            <div className="summary">
              <b>{total}</b> sesi · estimasi <b>{totalHoursLabel}</b> total · <em>{monthsLabel}</em> kalau weekly
            </div>
            {!isFinalized && (
              <>
                <button type="button" className="db-btn db-btn-outline" onClick={flushSaveNow} disabled={saveState === "saving"}>
                  {saveState === "saving" ? "Menyimpan…" : "Simpan draft"}
                </button>
                <button type="button" className="db-btn db-btn-primary" onClick={() => setConfirmFinalize(true)}>
                  Finalisasi & kirim ke {pairing.mentee.name.split(/\s+/)[0]} →
                </button>
              </>
            )}
            {isFinalized && (
              <Link href="/dashboard/mentee" className="db-btn db-btn-primary">
                ← Kembali ke Mentee
              </Link>
            )}
          </div>
        </div>

        {/* Side rail */}
        <aside className="rs-side">
          <div className="rs-side-card rs-why">
            <h3>Kenapa <em>10 sesi</em>?</h3>
            <p>Saran kurikulum Satu Tuju dibagi 5 fase: <b>Discovery</b> (kenalan + asesmen),
              <b> Planning</b> (shortlist kampus), <b>Writing</b> (motivation letter + CV),
              <b> Execution</b> (mock interview + audit), <b>Closing</b>.</p>
            <p style={{ marginTop: 8 }}>
              Kalau {pairing.mentee.name.split(/\s+/)[0]} sudah punya progress sendiri (mis. sudah punya draft ML),
              boleh kurangi sesi Writing.
            </p>
          </div>

          <div className="rs-side-card">
            <h3>Fase kurikulum</h3>
            <div className="rs-phase-legend">
              <div className="row"><span className="swatch" style={{ background: "#fef3c7" }} /> Discovery — kenalan + asesmen</div>
              <div className="row"><span className="swatch" style={{ background: "#dbeafe" }} /> Planning — kampus + strategi</div>
              <div className="row"><span className="swatch" style={{ background: "var(--primary-100)" }} /> Writing — dokumen</div>
              <div className="row"><span className="swatch" style={{ background: "#ede9fe" }} /> Execution — latihan + audit</div>
              <div className="row"><span className="swatch" style={{ background: "#d1fae5" }} /> Closing — evaluasi</div>
            </div>
          </div>

          <div className="rs-side-card">
            <h3>Setelah finalisasi</h3>
            <p>{pairing.mentee.name.split(/\s+/)[0]} dapat email berisi:</p>
            <p style={{ marginTop: 6 }}>
              <b>1.</b> Daftar {total} sesi (read-only)<br />
              <b>2.</b> Link booking jadwal pertama<br />
              <b>3.</b> Dokumen yang perlu disiapkan sebelum Sesi 1
            </p>
            <p style={{ marginTop: 8 }}>
              Mentor masih bisa edit per-sesi setelah finalisasi (judul, durasi). Jumlah sesi yang sudah
              disepakati nggak bisa diubah tanpa notifikasi ulang ke mentee.
            </p>
          </div>
        </aside>
      </div>

      <Modal
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        title={`Finalisasi & kirim ke ${pairing.mentee.name.split(/\s+/)[0]}?`}
        description={`${total} sesi akan dikirim ke ${pairing.mentee.email}. Mentee akan dapat email + notifikasi di dashboard. Kamu masih bisa edit judul/durasi per-sesi setelah ini.`}
        actions={
          <>
            <button type="button" className="db-btn db-btn-outline" onClick={() => setConfirmFinalize(false)} disabled={finalizing}>
              Tunggu dulu
            </button>
            <button type="button" className="db-btn db-btn-primary" onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? "Mengirim…" : "Ya, kirim sekarang"}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "var(--text-muted-3)", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 8px" }}>Setelah finalisasi:</p>
          <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
            <li>Jumlah sesi tidak bisa diubah tanpa kesepakatan ulang dengan mentee.</li>
            <li>Mentee bisa book slot pertama lewat link booking kamu.</li>
            <li>Status pairing berubah ke aktif.</li>
          </ul>
        </div>
      </Modal>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function randomId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);
}
