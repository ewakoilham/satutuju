"use client";

/** /welcome — post-activation landing.
 *
 *  Burst icon + greeting + CTA into the dashboard. Renders the user's name
 *  and role from /api/auth/me. Two-second auto-redirect to /dashboard
 *  unless the user clicks something first. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "../login/login.css";

interface Me {
  id: string;
  email: string;
  name: string;
  role: "mentor" | "mentee" | "admin";
}

export default function WelcomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe(data.user || data));
    const t = setTimeout(() => router.push("/dashboard"), 6000);
    return () => clearTimeout(t);
  }, [router]);

  const roleLabel = me?.role === "mentor" ? "mentor" : me?.role === "mentee" ? "mentee" : "admin";

  return (
    <div className="lh-shell">
      <div className="lh-backdrop">
        <span className="lh-blob lh-blob-1" />
        <span className="lh-blob lh-blob-2" />
        <span className="lh-blob lh-blob-3" />

        <div className="lh-frame lh-frame-narrow">
          <div className="lh-card lh-card-center">
            <BurstIcon />

            <h1 className="lh-title lh-title-center">
              Selamat datang,<br />
              <span className="lh-title-italic">{me?.name?.split(/\s+/)[0] || "kak"}.</span>
            </h1>
            <p className="lh-sub lh-sub-center">
              Akun {roleLabel} kamu aktif. Mentor &amp; mentee yang sudah dipasangkan
              akan muncul di dashboard.
            </p>

            <Link href="/dashboard" className="lh-cta lh-cta-center">
              Buka dashboard →
            </Link>

            <div className="lh-foot-divider" />
            <div className="lh-foot-note">Otomatis pindah ke dashboard dalam 6 detik.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BurstIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ margin: "0 auto 20px", display: "block" }}>
      <circle cx="40" cy="40" r="22" fill="var(--primary-100)" />
      <circle cx="40" cy="40" r="14" fill="var(--primary)" />
      <path d="M30 40l7 7 13-14" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <line key={i} x1="40" y1="10" x2="40" y2="4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${deg} 40 40)`} />
      ))}
    </svg>
  );
}
