"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branded panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-blue-soft via-brand-blue-soft/80 to-brand-lavender/60 flex-col items-center justify-center p-12 relative overflow-hidden">
        <Image src="/illustrations/puzzle-piece.png" alt="" width={140} height={150} className="absolute top-12 right-16 opacity-20" />
        <Image src="/illustrations/open-book.png" alt="" width={120} height={120} className="absolute bottom-20 left-12 opacity-20" />
        <Image src="/illustrations/globe.png" alt="" width={100} height={100} className="absolute bottom-12 right-20 opacity-15" />

        <div className="relative text-center">
          <Logo variant="main" size="lg" className="mx-auto mb-8" />
          <h2 className="text-2xl font-bold text-primary-800 mb-3 font-[family-name:var(--font-heading)]">
            Account Recovery
          </h2>
          <p className="text-primary-600/80 text-base max-w-sm leading-relaxed">
            We&apos;ll send you a secure link to reset your password and get back on track.
          </p>
          <div className="flex items-center justify-center gap-2 mt-10">
            <div className="w-2 h-2 rounded-full bg-brand-yellow" />
            <div className="w-2 h-2 rounded-full bg-primary/30" />
            <div className="w-2 h-2 rounded-full bg-brand-lavender" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Logo variant="main" size="md" className="mx-auto mb-2" />
            <p className="text-sm text-gray-400">Mentorship Platform</p>
          </div>

          <div className="card shadow-[var(--shadow-lg)] border-brand-lavender/30 p-8 rounded-2xl">
            {submitted ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-2xl mb-4">
                  <Icon name="check" size={22} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)] mb-2">
                  Check your inbox
                </h2>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  If that email is registered, you&apos;ll receive a reset link shortly. The link expires in 1 hour.
                </p>
                <Link href="/login" className="text-sm text-primary font-semibold hover:underline">
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-blue-soft rounded-2xl mb-3">
                    <Icon name="mail" size={22} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
                    Forgot Password?
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Enter your email to receive a reset link</p>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3 rounded-xl text-base mt-2"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                  <Link href="/login" className="text-primary font-semibold hover:underline">
                    Back to Sign In
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
