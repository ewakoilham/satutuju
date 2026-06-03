"use client";

/** Login page — v5 redesign.
 *
 *  States (managed in `view`):
 *    "default"     fresh form
 *    "wrong"       last login attempt failed (anti-enumeration copy)
 *    "forgot"      modal overlay for sending reset link
 *
 *  Google button kicks off /api/auth/google-login (302 → Google → callback).
 *  Email + kunci form posts to /api/auth/login; on 200 it redirects to
 *  /dashboard, on any 4xx it shows the anti-enumeration "wrong" copy. */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

type View = "default" | "wrong" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialErr = params.get("err");

  const [view, setView] = useState<View>("default");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Surface server-side redirect errors via ?err= once.
  useEffect(() => {
    if (!initialErr) return;
    const map: Record<string, string> = {
      "google-not-configured": "Login Google belum dikonfigurasi. Coba pakai email + kunci.",
      "oauth-state": "Sesi OAuth tidak valid. Coba mulai lagi dari awal.",
      "google-exchange": "Gagal verifikasi Google. Coba lagi.",
      "email-unverified": "Email Google kamu belum diverifikasi.",
      "user-create": "Gagal membuat akun. Coba lagi atau hubungi admin.",
    };
    setErrMsg(map[initialErr] || "Terjadi kesalahan. Coba lagi.");
  }, [initialErr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setView("wrong");
        setErrMsg(data.error || "Email atau kunci salah.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
    } finally {
      setLoading(false);
      setForgotSent(true);
    }
  }

  const showWrongAlert = view === "wrong";

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
              <span className="lh-gated">khusus mentor &amp; mentee</span>
            </div>

            <h1 className="lh-title">
              Halo lagi,<br />
              <span className="lh-title-italic">kak.</span>
            </h1>
            <p className="lh-sub">Masuk dengan akun yang sudah disiapkan tim setelah seleksi.</p>

            <a className="lh-google" href="/api/auth/google-login">
              <GoogleMark />
              <span>Lanjut dengan Google</span>
            </a>
            <div className="lh-divider"><span>atau</span></div>

            {showWrongAlert && (
              <div className="lh-alert lh-alert-warn">
                <strong>Email atau kunci salah.</strong>
                <p>Pastikan kamu pakai email yang sama dengan saat seleksi.</p>
                <small>Pesan ini sama untuk semua kasus, supaya akun member tidak bisa ditebak.</small>
              </div>
            )}
            {!showWrongAlert && errMsg && (
              <div className="lh-alert lh-alert-warn">
                <strong>{errMsg}</strong>
              </div>
            )}

            <form onSubmit={handleSubmit} className="lh-form" noValidate>
              <label className="lh-field">
                <span className="lh-field-label">Email</span>
                <div className={`lh-input ${showWrongAlert ? "lh-input-error" : ""} ${loading ? "lh-input-disabled" : ""}`}>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="kamu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </label>

              <label className="lh-field">
                <span className="lh-field-label">Kunci</span>
                <div className={`lh-input ${showWrongAlert ? "lh-input-error" : ""} ${loading ? "lh-input-disabled" : ""}`}>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="lh-eye"
                    onClick={() => setShowPw((x) => !x)}
                    aria-label={showPw ? "Sembunyikan kunci" : "Tampilkan kunci"}
                  >
                    <EyeIcon hidden={showPw} />
                  </button>
                </div>
              </label>

              <div className="lh-forgot">
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setForgotSent(false); setView("forgot"); }}
                  className="lh-link-btn"
                >
                  Lupa kunci?
                </button>
              </div>

              <button
                type="submit"
                className="lh-cta"
                disabled={loading}
              >
                {loading ? "Memproses…" : "Masuk →"}
              </button>
            </form>

            <div className="lh-foot-divider" />
            <div className="lh-apply">
              <span>Belum punya akun?</span>
              <a href="https://satutuju.id" target="_blank" rel="noopener noreferrer">
                Ikuti seleksi mentor / mentee →
              </a>
            </div>
            <div className="lh-foot-note">seleksi → wawancara → undangan via email</div>
          </div>

          <aside className="lh-side">
            <div className="lh-side-quote">
              <span className="lh-side-eyebrow">Komunitas</span>
              <p className="lh-side-text">
                <span className="lh-quote-mark">&ldquo;</span>
                Mentormu sudah pernah berdiri di posisi kamu. Login ini cuma langkah pertama.
                <span className="lh-quote-mark">&rdquo;</span>
              </p>
              <div className="lh-side-author">
                <div className="lh-side-av lh-side-av-c2">RY</div>
                <div>
                  <div className="lh-side-name">Rey Pradana</div>
                  <div className="lh-side-meta">mentor · TU Delft &apos;23</div>
                </div>
              </div>
            </div>

            <div className="lh-side-stats">
              {[["120", "mentor"], ["840", "mentee"], ["45", "kampus"]].map(([n, l]) => (
                <div key={l} className="lh-stat">
                  <div className="lh-stat-num">{n}</div>
                  <div className="lh-stat-lbl">{l}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {view === "forgot" && (
        <div className="lh-modal-overlay" onClick={() => setView("default")}>
          <div className="lh-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lh-modal-close" onClick={() => setView("default")}>×</button>
            <h2 className="lh-modal-title">Lupa kunci?</h2>
            {!forgotSent ? (
              <>
                <p className="lh-modal-sub">
                  Masukkan email kamu — kalau terdaftar, kami kirim tautan reset.
                  Pesan ini sama untuk semua kasus, supaya akun member tidak bisa ditebak.
                </p>
                <form onSubmit={handleForgotSubmit} className="lh-form">
                  <label className="lh-field">
                    <span className="lh-field-label">Email</span>
                    <div className="lh-input">
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="kamu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                      />
                    </div>
                  </label>
                  <button type="submit" className="lh-cta" disabled={loading}>
                    {loading ? "Mengirim…" : "Kirim tautan reset →"}
                  </button>
                </form>
              </>
            ) : (
              <div className="lh-alert lh-alert-info" role="status">
                <strong>Cek email kamu.</strong>
                <p>
                  Kalau email <b>{forgotEmail}</b> terdaftar di Satu Tuju, tautan reset
                  sudah kami kirim. Tautan berlaku 24 jam dan hanya bisa dipakai sekali.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleMark() {
  // Full-colour Google "G" mark — required by Google's branding terms.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.56 2.69-3.87 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.8.55-1.84.87-3.05.87a5.27 5.27 0 0 1-4.97-3.66H.99v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M4.03 10.77a5.4 5.4 0 0 1 0-3.45V5.02H.99a9 9 0 0 0 0 7.96l3.04-2.21z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .99 5.02L4.03 7.32A5.27 5.27 0 0 1 9 3.58z" />
    </svg>
  );
}

/** Eye toggle icon for password show/hide. `hidden=true` = password is
 *  currently visible, show the crossed-out eye. */
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
