"use client";

/** First-run guided tour for new mentors.
 *
 *  Runs once, on the first /dashboard visit, for a mentor whose
 *  `MentorProfile.tourSeenAt` is null (existing mentors were backfilled to
 *  now(), so only brand-new mentors see it). Walks the top nav feature by
 *  feature, then marks the tour seen. Fully skippable (Esc / overlay / ✕).
 *  Desktop only — the nav anchors are hidden on small screens. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

interface Step {
  href: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { href: "/dashboard",              title: "Beranda",  description: "Ringkasan harian kamu — sapaan, sesi hari ini, dan apa yang butuh perhatian." },
  { href: "/dashboard/mentee",       title: "Mentee",   description: "Daftar mentee yang dipasangkan ke kamu, lengkap dengan progres dan status dokumen mereka." },
  { href: "/dashboard/leads",        title: "Leads",    description: "Calon mentee yang sedang di-proses tim admin sebelum dipasangkan." },
  { href: "/dashboard/schedule",     title: "Jadwal",   description: "Atur ketersediaan & slot sesi kamu di sini. Mulai dari sini setelah profil lengkap." },
  { href: "/dashboard/resources",    title: "Materi",   description: "Materi dan kurikulum yang bisa kamu pakai untuk tiap sesi." },
  { href: "/dashboard/universities", title: "Kampus",   description: "Database kampus tujuan untuk bantu riset bareng mentee." },
];

export default function MentorTour({ role }: { role: string | undefined }) {
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (role !== "mentor") return;
    if (pathname !== "/dashboard") return;
    if (started.current) return;
    // Desktop only — the top-nav anchors are hidden below the `sm` breakpoint.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) return;

    let cancelled = false;
    fetch("/api/mentor-profile", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || started.current) return;
        const profile = data?.profile;
        // A profile row that already has tourSeenAt → skip. No row yet (brand
        // new) also means not-seen, but in practice a mentor only reaches
        // /dashboard after onboarding has created the row.
        if (profile?.tourSeenAt) return;

        const steps: DriveStep[] = STEPS.filter((s) =>
          document.querySelector(`[data-tour="${s.href}"]`),
        ).map((s) => ({
          element: `[data-tour="${s.href}"]`,
          popover: { title: s.title, description: s.description, side: "bottom", align: "start" },
        }));
        if (steps.length === 0) return;

        started.current = true;

        const markSeen = () => {
          fetch("/api/mentor-profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tourSeenAt: new Date().toISOString() }),
          }).catch(() => {});
        };

        const d = driver({
          showProgress: true,
          allowClose: true,
          overlayOpacity: 0.6,
          nextBtnText: "Lanjut",
          prevBtnText: "Kembali",
          doneBtnText: "Selesai",
          progressText: "{{current}} / {{total}}",
          steps,
          // Fires on finish AND on skip/close — either way, don't show it again.
          onDestroyed: markSeen,
        });
        d.drive();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [role, pathname]);

  return null;
}
