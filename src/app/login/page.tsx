"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Surface errors bounced back from the Google login callback (?err=...).
  // Read from the URL client-side so we don't need useSearchParams (which
  // would force a Suspense boundary / break the static build).
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("err");
    if (!err) return;
    const messages: Record<string, string> = {
      "google-not-configured": "Login Google belum tersedia. Gunakan email + kunci.",
      "oauth-state": "Sesi login Google kedaluwarsa. Coba lagi.",
      "google-exchange": "Gagal memverifikasi akun Google. Coba lagi.",
      "email-unverified": "Email Google kamu belum terverifikasi.",
      "user-create": "Gagal membuat akun. Hubungi admin.",
    };
    setError(messages[err] || "Login Google gagal. Coba lagi.");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="force-light min-h-screen flex items-center justify-center bg-brand-blue-soft relative overflow-hidden px-4 py-12">
      {/* Decorative illustrations */}
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
              <Icon name="user" size={22} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Sign In
            </h2>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="bg-danger-light text-danger text-sm px-4 py-2.5 rounded-xl mb-4 flex items-center gap-2 animate-slide-in-up">
              <Icon name="x" size={14} />
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <a
            href="/api/auth/google-login"
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-border bg-white hover:bg-surface-elevated transition font-medium text-sm text-foreground"
          >
            <GoogleMark />
            Lanjut dengan Google
          </a>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-gray-400 font-medium tracking-wide">ATAU</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-11"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
                </button>
              </div>
              <div className="text-right mt-1">
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-xl text-base mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Akses hanya lewat undangan. Butuh bantuan?{" "}
            <a
              href="mailto:hello@satutuju.id"
              className="text-primary font-semibold hover:underline"
            >
              Hubungi tim
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Multicolor Google "G" mark for the sign-in button. */
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
