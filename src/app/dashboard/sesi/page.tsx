"use client";

/** /dashboard/sesi — index. There's no standalone list page; the journey
 *  rail lives inside each session at /dashboard/sesi/[id]. This entry point
 *  resolves the viewer's "current" session and redirects there:
 *    - mentee → first non-completed session of their active pairing (else
 *      the last session, else Beranda).
 *    - mentor/admin → the Mentee tab (they reach sessions via a pairing).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

interface SessionRow {
  id: string;
  sessionNum: number;
  status: string;
  mentorSubmittedAt?: string | null;
}

export default function SesiIndexPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    if (user.role !== "mentee") {
      router.replace("/dashboard/mentee");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const list = await fetch("/api/pairings").then((r) => r.json()).catch(() => ({ pairings: [] }));
        const pairings: Array<{ id: string; status: string }> = list.pairings || [];
        const pick = pairings.find((p) => p.status === "active") || pairings[0];
        if (!pick) {
          if (!cancelled) router.replace("/dashboard");
          return;
        }
        const data = await fetch(`/api/pairings/${pick.id}`).then((r) => r.json());
        const sessions: SessionRow[] = [...(data?.pairing?.sessions || [])].sort(
          (a: SessionRow, b: SessionRow) => a.sessionNum - b.sessionNum,
        );
        if (sessions.length === 0) {
          if (!cancelled) router.replace("/dashboard");
          return;
        }
        const isDone = (s: SessionRow) => s.status === "completed" || !!s.mentorSubmittedAt;
        const target = sessions.find((s) => !isDone(s)) || sessions[sessions.length - 1];
        if (!cancelled) router.replace(`/dashboard/sesi/${target.id}`);
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    })();

    return () => { cancelled = true; };
  }, [loading, user, router]);

  return <SkeletonDashboard />;
}
