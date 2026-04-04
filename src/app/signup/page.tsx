"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

const ROLES = [
  { value: "mentee", label: "Mentee", icon: "graduation", desc: "I want guidance" },
  { value: "mentor", label: "Mentor", icon: "star", desc: "I want to guide" },
  { value: "admin", label: "Admin", icon: "settings", desc: "Manage platform" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("mentee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Signup failed");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branded panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-blue-soft via-brand-blue-soft/80 to-brand-lavender/60 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative puzzle shapes */}
        <svg viewBox="0 0 120 120" fill="none" className="absolute top-10 left-10 w-40 h-40 text-primary/5">
          <path d="M50 10a10 10 0 0120 0v8a4 4 0 004 4h24a8 8 0 018 8v24a4 4 0 01-4 4 10 10 0 000 20 4 4 0 014 4v24a8 8 0 01-8 8H74a4 4 0 01-4-4 10 10 0 00-20 0 4 4 0 01-4 4H22a8 8 0 01-8-8V82a4 4 0 00-4-4 10 10 0 010-20 4 4 0 004-4V30a8 8 0 018-8h24a4 4 0 004-4V10z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 120 120" fill="none" className="absolute bottom-10 right-10 w-56 h-56 text-brand-yellow/20 rotate-90">
          <path d="M50 10a10 10 0 0120 0v8a4 4 0 004 4h24a8 8 0 018 8v24a4 4 0 01-4 4 10 10 0 000 20 4 4 0 014 4v24a8 8 0 01-8 8H74a4 4 0 01-4-4 10 10 0 00-20 0 4 4 0 01-4 4H22a8 8 0 01-8-8V82a4 4 0 00-4-4 10 10 0 010-20 4 4 0 004-4V30a8 8 0 018-8h24a4 4 0 004-4V10z" fill="currentColor" />
        </svg>

        <div className="relative text-center">
          <Logo variant="main" size="lg" className="mx-auto mb-8" />
          <h2 className="text-2xl font-bold text-primary-800 mb-3 font-[family-name:var(--font-heading)]">
            Join our community
          </h2>
          <p className="text-primary-600/80 text-base max-w-sm leading-relaxed">
            Start your journey towards studying abroad with a personal mentor who&apos;s been there before.
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
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-yellow/60 rounded-2xl mb-3">
                <Icon name="plus" size={22} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">
                Create Account
              </h2>
              <p className="text-sm text-gray-400 mt-1">Join the Satu Tuju mentorship community</p>
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
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input-field"
                  placeholder="Your full name"
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
                    minLength={6}
                    className="input-field pr-11"
                    placeholder="Min. 6 characters"
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
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  I am a...
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium border transition-all ${
                        role === r.value
                          ? "bg-primary text-white border-primary shadow-[var(--shadow-sm)]"
                          : "bg-white text-gray-500 border-border hover:border-primary-200 hover:bg-primary-50"
                      }`}
                    >
                      {role === r.value && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-yellow rounded-full flex items-center justify-center">
                          <Icon name="check" size={10} className="text-primary-800" />
                        </div>
                      )}
                      <Icon name={r.icon} size={18} />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-xl text-base mt-2"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-6">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary font-semibold hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
