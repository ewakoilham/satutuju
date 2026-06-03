"use client";

/** /activate?token=... — first-login set-kunci screen (v5 design).
 *
 *  Layout: 2-col card + side ribbon (matches /login).
 *  Header: logo + 3-step "langkah 2 dari 3" stepper.
 *  Body: verified-email card → kunci → criteria → konfirmasi kunci → CTA.
 *  Footer: "Atau lewati — aktivasi dengan Google saja" alt path. */

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../login/login.css";

const RULES: Array<{ key: string; label: string; test: (s: string) => boolean }> = [
  { key: "len",   label: "Minimal 8 karakter",  test: (s) => s.length >= 8 },
  { key: "upper", label: "1 huruf besar (A-Z)", test: (s) => /[A-Z]/.test(s) },
  { key: "lower", label: "1 huruf kecil (a-z)", test: (s) => /[a-z]/.test(s) },
  { key: "num",   label: "1 angka (0-9)",       test: (s) => /\d/.test(s) },
];

interface InviteMeta {
  email: string;
  role: "mentor" | "mentee" | "admin";
}

// Wrapped in <Suspense> by the default export below — useSearchParams()
// requires a suspense boundary or the static build fails to prerender.
function ActivatePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resolve the invite token → email so the user sees who they're activating as.
  useEffect(() => {
    if (!token) { setErr("Tautan aktivasi tidak valid."); setLoadingMeta(false); return; }
    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErr(data.error || "Tautan aktivasi tidak valid atau sudah kedaluwarsa.");
        } else {
          setMeta({ email: data.email, role: data.role });
        }
      })
      .catch(() => setErr("Gagal verifikasi tautan. Coba refresh."))
      .finally(() => setLoadingMeta(false));
  }, [token]);

  const checks = useMemo(() => RULES.map((r) => ({ ...r, ok: r.test(password) })), [password]);
  const allOk = checks.every((c) => c.ok);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = !!token && allOk && matches && !submitting && !!meta;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Gagal aktivasi.");
        return;
      }
      router.push("/welcome");
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel = meta?.role === "mentor" ? "mentor" : meta?.role === "mentee" ? "mentee" : "admin";

  return (
    <div className="lh-shell">
      <div className="lh-backdrop">
        <span className="lh-blob lh-blob-1" />
        <span className="lh-blob lh-blob-2" />
        <span className="lh-blob lh-blob-3" />

        <div className="lh-frame">
          <div className="lh-card">
            <div className="lh-card-head">
              <div className="lh-logo">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="9" fill="#3958b3" />
                  <path d="M12 14h16M12 20h16M12 26h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
                <span className="lh-logo-word">satu tuju</span>
              </div>
              <div className="lh-stepper" aria-label="Langkah aktivasi">
                <span className="lh-stepper-pill done">1</span>
                <span className="lh-stepper-line done" />
                <span className="lh-stepper-pill on">2</span>
                <span className="lh-stepper-line" />
                <span className="lh-stepper-pill">3</span>
                <span className="lh-stepper-label">langkah 2 dari 3</span>
              </div>
            </div>

            <h1 className="lh-title">
              Buat kunci<br />
              <span className="lh-title-italic">kamu sendiri.</span>
            </h1>
            <p className="lh-sub">
              Kunci ini cuma kamu yang tahu — kami tidak pernah menyimpannya dalam bentuk asli.
            </p>

            {err && !meta && (
              <div className="lh-alert lh-alert-warn">
                <strong>{err}</strong>
                <p>Minta admin kirim ulang undangan, atau hubungi <a href="mailto:hello@satutuju.id">hello@satutuju.id</a>.</p>
              </div>
            )}

            {loadingMeta && (
              <div className="lh-alert lh-alert-info">
                <strong>Memeriksa undangan…</strong>
              </div>
            )}

            {meta && (
              <>
                <div className="lh-verified">
                  <span className="lh-verified-icon" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-11" />
                    </svg>
                  </span>
                  <div>
                    <div className="lh-verified-title">Email diundang sebagai {roleLabel}</div>
                    <div className="lh-verified-email">{meta.email}</div>
                  </div>
                </div>

                {err && (
                  <div className="lh-alert lh-alert-warn">
                    <strong>{err}</strong>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="lh-form" noValidate>
                  <label className="lh-field">
                    <span className="lh-field-label">Kunci baru</span>
                    <div className="lh-input">
                      <input
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        required
                      />
                      <button type="button" className="lh-eye" onClick={() => setShowPw((x) => !x)} aria-label={showPw ? "Sembunyikan kunci" : "Tampilkan kunci"}>
                        <EyeIcon hidden={showPw} />
                      </button>
                    </div>
                  </label>

                  <ul className="lh-criteria">
                    {checks.map((c) => (
                      <li key={c.key} className={`lh-criteria-item ${c.ok ? "ok" : ""}`}>
                        <span className="lh-criteria-check" aria-hidden="true">{c.ok ? "✓" : ""}</span>
                        {c.label}
                      </li>
                    ))}
                  </ul>

                  <label className="lh-field" style={{ marginTop: 18 }}>
                    <span className="lh-field-label">Konfirmasi kunci</span>
                    <div className={`lh-input ${confirm.length > 0 && !matches ? "lh-input-error" : ""}`}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Ketik ulang"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                      <button type="button" className="lh-eye" onClick={() => setShowConfirm((x) => !x)} aria-label={showConfirm ? "Sembunyikan kunci" : "Tampilkan kunci"}>
                        <EyeIcon hidden={showConfirm} />
                      </button>
                    </div>
                    {confirm.length > 0 && !matches && (
                      <small style={{ color: "var(--danger)", fontSize: 12, marginTop: 6, display: "block" }}>
                        Kunci tidak sama. Coba ketik ulang.
                      </small>
                    )}
                  </label>

                  <button
                    type="submit"
                    className="lh-cta"
                    disabled={!canSubmit}
                    style={{ marginTop: 20 }}
                  >
                    {submitting ? "Mengaktifkan…" : "Simpan & masuk →"}
                  </button>
                </form>

                <div className="lh-foot-divider" />
                <p className="lh-alt-path">
                  Atau lewati — <a href="/api/auth/google-login">aktivasi dengan Google saja</a> tanpa perlu kunci.
                </p>
              </>
            )}
          </div>

          {/* Side ribbon — Tips kunci */}
          <aside className="lh-side">
            <div className="lh-side-quote">
              <span className="lh-side-eyebrow">Tips kunci</span>
              <p className="lh-side-text-sm">
                Pakai 3 kata acak yang gampang kamu ingat tapi susah ditebak —
                lebih kuat dan lebih praktis dari &quot;Password123!&quot;.
              </p>
              <div className="lh-tip-example">
                <span className="mono">kopi.matahari.sungai</span>
              </div>
            </div>

            <div className="lh-side-stats">
              <div className="lh-stat">
                <div className="lh-stat-num">7d</div>
                <div className="lh-stat-lbl">undangan berlaku</div>
              </div>
              <div className="lh-stat">
                <div className="lh-stat-num">1×</div>
                <div className="lh-stat-lbl">pakai tautan</div>
              </div>
              <div className="lh-stat">
                <div className="lh-stat-num">2FA</div>
                <div className="lh-stat-lbl">tersedia nanti</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Eye icon for the show/hide password toggle. `hidden=false` (password is
 *  currently masked) shows the "eye open" — meaning "click to reveal".
 *  `hidden=true` (password is currently visible) shows the "eye crossed". */
function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivatePageInner />
    </Suspense>
  );
}
