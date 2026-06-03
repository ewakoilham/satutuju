"use client";

/** /belum-aktif — outsider tried Google login without a matching invite.
 *
 *  Explains the seleksi process in 3 steps + CTA to the public seleksi
 *  page. No way back into the app from here without an invite. */

import Link from "next/link";
import "../login/login.css";

const STEPS: Array<{ n: string; title: string; body: string }> = [
  {
    n: "01",
    title: "Daftar lewat seleksi",
    body: "Isi form aplikasi mentor / mentee di satutuju.id. Cerita pengalaman + target kamu, jangan terlalu formal.",
  },
  {
    n: "02",
    title: "Wawancara singkat",
    body: "Tim Satu Tuju ngobrol 20 menit untuk pastikan ada match sebelum kamu dipasangkan.",
  },
  {
    n: "03",
    title: "Undangan via email",
    body: "Kalau cocok, kamu dapet email undangan dari kami. Tautan di dalamnya yang ngebuka login.",
  },
];

export default function BelumAktifPage() {
  return (
    <div className="lh-shell">
      <div className="lh-backdrop">
        <span className="lh-blob lh-blob-1" />
        <span className="lh-blob lh-blob-2" />
        <span className="lh-blob lh-blob-3" />

        <div className="lh-frame lh-frame-narrow">
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
              Akun <span className="lh-title-italic">belum aktif.</span>
            </h1>
            <p className="lh-sub">
              Login Satu Tuju hanya untuk mentor &amp; mentee yang sudah lewat seleksi.
              Kalau kamu rasa ini salah, hubungi tim di{" "}
              <a href="mailto:hi@satutuju.id">hi@satutuju.id</a>.
            </p>

            <ol className="lh-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="lh-step-num">{s.n}</span>
                  <div>
                    <div className="lh-step-title">{s.title}</div>
                    <p className="lh-step-text">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <a
              className="lh-cta"
              href="https://satutuju.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mulai seleksi mentor / mentee →
            </a>

            <div className="lh-foot-divider" />
            <div className="lh-apply">
              <span>Sudah punya invite?</span>
              <Link href="/login">Kembali ke login</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
