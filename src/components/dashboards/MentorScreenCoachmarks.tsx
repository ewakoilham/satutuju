"use client";

/** v2 of the new-mentor onboarding tour: per-screen contextual coachmarks.
 *
 *  After the nav-level tour ([[MentorTour]]), the first time a new mentor
 *  opens each feature screen we point at that screen's key area with a single
 *  coachmark, then remember it so it never shows again. "Seen" screens are
 *  tracked in MentorProfile.tourScreensSeen (a JSON array). Existing mentors
 *  were backfilled to all-seen, so only brand-new mentors get these.
 *
 *  Lives in the dashboard layout (persists across navigation). On each route
 *  change it polls briefly for the destination screen's `data-tour-screen`
 *  anchor (the child page mounts after navigation), then drives one step.
 *  Mentor-only, desktop-only. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface ScreenHint {
  key: string;
  title: string;
  description: string;
}

const SCREEN_HINTS: Record<string, ScreenHint> = {
  "/dashboard/schedule": {
    key: "schedule",
    title: "Jadwal",
    description:
      'Klik slot kosong di kalender untuk buka ketersediaan — atau pakai "Aturan ketersediaan rutin" biar slot otomatis muncul tiap minggu.',
  },
  "/dashboard/mentee": {
    key: "mentee",
    title: "Mentee",
    description:
      "Setiap mentee yang dipasangkan muncul di sini — pantau progres sesi, status dokumen, dan apa yang perlu kamu tindak lanjuti.",
  },
  "/dashboard/leads": {
    key: "leads",
    title: "Leads",
    description:
      "Calon mentee dari pendaftaran. Tandai yang kamu kenal; admin yang lanjut memproses sisanya.",
  },
  "/dashboard/resources": {
    key: "resources",
    title: "Materi",
    description:
      "Materi & kurikulum tersusun per sesi. Buka sebelum sesi biar waktu bareng mentee lebih maksimal.",
  },
  "/dashboard/universities": {
    key: "universities",
    title: "Kampus",
    description:
      "Cari & filter kampus tujuan di sini untuk bantu riset bareng mentee.",
  },
};

export default function MentorScreenCoachmarks({ role }: { role: string | undefined }) {
  const pathname = usePathname();
  // null = not loaded yet; a Set once /api/mentor-profile has answered.
  const seenRef = useRef<Set<string> | null>(null);
  const loadingRef = useRef(false);
  const activeRef = useRef(false);

  // Load the seen-set once.
  useEffect(() => {
    if (role !== "mentor" || seenRef.current || loadingRef.current) return;
    loadingRef.current = true;
    fetch("/api/mentor-profile", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        let arr: unknown = [];
        try { arr = JSON.parse(data?.profile?.tourScreensSeen || "[]"); } catch { arr = []; }
        seenRef.current = new Set(Array.isArray(arr) ? (arr as string[]) : []);
      })
      .catch(() => { seenRef.current = new Set(); });
  }, [role]);

  useEffect(() => {
    if (role !== "mentor") return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) return;
    const hint = SCREEN_HINTS[pathname];
    if (!hint || activeRef.current) return;

    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      // Wait for the seen-set to resolve before deciding.
      if (!seenRef.current) {
        if (tries++ > 30) return;
        setTimeout(tick, 120);
        return;
      }
      if (seenRef.current.has(hint.key)) return; // already shown before
      const sel = `[data-tour-screen="${hint.key}"]`;
      if (!document.querySelector(sel)) {
        // Child page hasn't mounted yet — retry within a ~4s budget.
        if (tries++ > 30) return;
        setTimeout(tick, 120);
        return;
      }
      activeRef.current = true;
      seenRef.current.add(hint.key); // optimistic — don't repeat this session
      // Read-modify-write so we merge THIS screen's key into whatever the
      // server already has, rather than overwriting with possibly-stale local
      // state (navigation/full-reload/StrictMode can reset the in-memory set).
      const persist = async () => {
        try {
          const cur = await fetch("/api/mentor-profile", { cache: "no-store", credentials: "include" })
            .then((r) => (r.ok ? r.json() : null));
          let arr: unknown = [];
          try { arr = JSON.parse(cur?.profile?.tourScreensSeen || "[]"); } catch { arr = []; }
          const merged = new Set(Array.isArray(arr) ? (arr as string[]) : []);
          merged.add(hint.key);
          seenRef.current = merged;
          await fetch("/api/mentor-profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tourScreensSeen: JSON.stringify(Array.from(merged)) }),
          });
        } catch {
          /* leave the optimistic local add in place for this session */
        }
      };
      const d = driver({
        showProgress: false,
        allowClose: true,
        overlayOpacity: 0.55,
        showButtons: ["next", "close"],
        nextBtnText: "Mengerti",
        doneBtnText: "Mengerti",
        steps: [
          {
            element: sel,
            popover: { title: hint.title, description: hint.description, side: "bottom", align: "start" },
          },
        ],
        onDestroyed: () => { activeRef.current = false; persist(); },
      });
      d.drive();
    };

    const t = setTimeout(tick, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [role, pathname]);

  return null;
}
