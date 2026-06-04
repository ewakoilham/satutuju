"use client";

/** /activate?token=... — first-login "set your key" screen.
 *
 *  Mirrors the /login layout: centered light card on the brand-blue-soft
 *  wash, Logo + "Mentorship Platform", then verified-email → key → criteria
 *  → confirm → CTA, with a Google fallback. */

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

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
    <div className="force-light min-h-screen flex items-center justify-center bg-brand-blue-soft relative overflow-hidden px-4 py-12">
      {/* Decorative illustrations — same as /login */}
      <Image src="/illustrations/puzzle-piece.png" alt="" width={140} height={150} className="absolute top-12 right-16 opacity-15 pointer-events-none" />
      <Image src="/illustrations/open-book.png" alt="" width={120} height={120} className="absolute bottom-20 left-12 opacity-15 pointer-events-none" />
      <Image src="/illustrations/globe.png" alt="" width={100} height={100} className="absolute bottom-12 right-20 opacity-10 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <Logo variant="main" size="md" className="mx-auto mb-2" />
          <p className="text-sm text-primary-600/70">Mentorship Platform</p>
        </div>

        <div className="card shadow-[var(--shadow-lg)] border-brand-lavender/30 p-8 rounded-2xl bg-white/95 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-blue-soft rounded-2xl mb-3">
              <Icon name="lock" size={22} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Buat Kunci Kamu
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Kunci ini cuma kamu yang tahu — kami tidak menyimpannya dalam bentuk asli.
            </p>
          </div>

          {/* Invalid / expired token — no meta to continue */}
          {err && !meta && (
            <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-xl mb-2">
              <div className="flex items-center gap-2 font-medium">
                <Icon name="x" size={14} /> {err}
              </div>
              <p className="mt-1 text-xs">
                Minta admin kirim ulang undangan, atau hubungi{" "}
                <a href="mailto:hello@satutuju.id" className="underline">hello@satutuju.id</a>.
              </p>
            </div>
          )}

          {loadingMeta && (
            <p className="text-center text-sm text-gray-400 py-2">Memeriksa undangan…</p>
          )}

          {meta && (
            <>
              {/* Verified invite email */}
              <div className="bg-success-light/60 border border-success/30 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-success text-white flex-shrink-0">
                  <Icon name="check" size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-success">
                    Email diundang sebagai {roleLabel}
                  </div>
                  <div className="text-sm font-medium text-foreground truncate">{meta.email}</div>
                </div>
              </div>

              {/* Runtime submit error */}
              {err && (
                <div className="bg-danger-light text-danger text-sm px-4 py-2.5 rounded-xl mb-4 flex items-center gap-2">
                  <Icon name="x" size={14} /> {err}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Kunci baru</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      required
                      className="input-field pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((x) => !x)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
                      aria-label={showPw ? "Sembunyikan kunci" : "Tampilkan kunci"}
                    >
                      <Icon name={showPw ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                </div>

                {/* Requirements */}
                <ul className="space-y-1.5 bg-brand-blue-soft/40 rounded-xl p-3">
                  {checks.map((c) => (
                    <li key={c.key} className={`flex items-center gap-2 text-xs ${c.ok ? "text-success font-medium" : "text-gray-400"}`}>
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border flex-shrink-0 ${c.ok ? "bg-success border-success text-white" : "border-gray-300"}`}>
                        {c.ok && <Icon name="check" size={10} />}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400">
                  Tip: pakai 3 kata acak yang gampang diingat tapi susah ditebak — mis.{" "}
                  <span className="font-mono text-gray-500">kopi.matahari.sungai</span>.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Konfirmasi kunci</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Ketik ulang"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className={`input-field pr-11 ${confirm.length > 0 && !matches ? "border-danger" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((x) => !x)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
                      aria-label={showConfirm ? "Sembunyikan kunci" : "Tampilkan kunci"}
                    >
                      <Icon name={showConfirm ? "eye-off" : "eye"} size={18} />
                    </button>
                  </div>
                  {confirm.length > 0 && !matches && (
                    <p className="text-xs text-danger mt-1">Kunci tidak sama. Coba ketik ulang.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary w-full py-3 rounded-xl text-base mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Mengaktifkan…" : "Simpan & masuk"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-gray-400 font-medium tracking-wide">ATAU</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <a
                href="/api/auth/google-login"
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-border bg-white hover:bg-surface-elevated transition font-medium text-sm text-foreground"
              >
                <GoogleMark />
                Aktivasi dengan Google saja
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Multicolor Google "G" mark — matches /login. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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
