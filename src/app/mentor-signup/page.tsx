"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

/**
 * Mentor-only signup. Intentionally NOT linked from the landing page —
 * shared as a direct URL with prospective mentors. The public /signup
 * page is reserved for mentees (Tally inquiry form).
 *
 * Creates a User with role="mentor" via the existing /api/auth/signup
 * endpoint, then routes to /dashboard/mentor-onboarding so the new
 * mentor fills out their profile.
 */
export default function MentorSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password harus minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role: "mentor" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Pendaftaran gagal, coba lagi.");
      return;
    }

    router.push("/dashboard/mentor-onboarding");
  }

  return (
    <div className="force-light min-h-screen flex items-center justify-center bg-brand-blue-soft relative overflow-hidden px-4 py-12">
      {/* Decorative illustrations — matches /login + /signup pattern */}
      <Image src="/illustrations/puzzle-piece.png" alt="" width={140} height={150} className="absolute top-12 right-16 opacity-15 pointer-events-none hidden md:block" />
      <Image src="/illustrations/open-book.png" alt="" width={120} height={120} className="absolute bottom-20 left-12 opacity-15 pointer-events-none hidden md:block" />
      <Image src="/illustrations/globe.png" alt="" width={100} height={100} className="absolute bottom-12 right-20 opacity-10 pointer-events-none hidden md:block" />

      <div className="relative w-full max-w-md">
        <div className="card shadow-[var(--shadow-lg)] border-brand-lavender/30 px-6 sm:px-8 pt-8 pb-6 sm:pt-10 sm:pb-8 rounded-2xl bg-white/95 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center bg-brand-yellow/60 rounded-2xl mb-3 px-4 py-2">
              <Logo variant="main" size="xs" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Daftar sebagai Mentor
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Bergabung jadi mentor Satu Tuju & bantu mentee Indonesia ke kampus impian
            </p>
          </div>

          {error && (
            <div className="bg-danger-light text-danger text-sm px-4 py-2.5 rounded-xl mb-4 flex items-center gap-2 animate-slide-in-up">
              <Icon name="x" size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="input-field"
                placeholder="Sesuai KTP / Paspor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                  autoComplete="new-password"
                  className="input-field pr-11"
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Konfirmasi Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="input-field"
                placeholder="Ulangi password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-xl text-base mt-2"
            >
              {loading ? "Mendaftarkan..." : "Daftar sebagai Mentor"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
