"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push("/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setSuccess(true);
  }

  if (!token) {
    return (
      <>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-2xl mb-3">
            <Icon name="x" size={22} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
            Invalid link
          </h2>
          <p className="text-sm text-gray-400 mt-1">This reset link is missing a token.</p>
        </div>
        <Link href="/forgot-password" className="btn-primary w-full py-3 rounded-xl text-base text-center block">
          Request a new reset link
        </Link>
      </>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-2xl mb-4">
          <Icon name="check" size={22} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)] mb-2">
          Password updated!
        </h2>
        <p className="text-sm text-gray-500">Redirecting to login&hellip;</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-blue-soft rounded-2xl mb-3">
          <Icon name="lock" size={22} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
          Set New Password
        </h2>
        <p className="text-sm text-gray-400 mt-1">Choose a strong password to protect your account</p>
      </div>

      {error && (
        <div className="bg-danger-light text-danger text-sm px-4 py-2.5 rounded-xl mb-4 flex items-center gap-2 animate-slide-in-up">
          <Icon name="x" size={14} />
          {error.includes("expired") || error.includes("Invalid") ? (
            <span>
              {error}{" "}
              <Link href="/forgot-password" className="underline font-medium">
                Request a new link
              </Link>
            </span>
          ) : (
            error
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field pr-11"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="input-field pr-11"
              placeholder="Repeat your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition"
            >
              <Icon name={showConfirm ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 rounded-xl text-base mt-2"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Back to Sign In
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-blue-soft via-brand-blue-soft/80 to-brand-lavender/60 relative overflow-hidden px-4 py-12">
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
          <Suspense fallback={<div className="text-center py-8 text-gray-400 text-sm">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
