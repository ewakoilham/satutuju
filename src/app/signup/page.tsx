"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("mentee");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--primary)]">
            SATU TUJU
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mentorship Platform
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-5"
        >
          <h2 className="text-xl font-semibold text-center">Create Account</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
              placeholder="Min. 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              I am a...
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "mentee", label: "Mentee" },
                { value: "mentor", label: "Mentor" },
                { value: "admin", label: "Admin" },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition ${
                    role === r.value
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[var(--primary)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--primary)] text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[var(--primary)] font-medium hover:underline"
            >
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
