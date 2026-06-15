"use client";

/** Admin view of mentee → SatuTuju feedback (GET /api/feedback). Separate from
 *  the per-session mentor ratings summary. */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  anonymous: boolean;
  status: string;
  createdAt: string;
  from: string;
  email: string | null;
}

const CAT_VARIANT: Record<string, "info" | "danger" | "neutral"> = {
  Saran: "info",
  Kendala: "danger",
  Lainnya: "neutral",
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function AdminFeedbackPage() {
  const { user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") { router.push("/dashboard"); return; }
    if (user) load();
  }, [user, router, load]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">Masukan ke SatuTuju</h1>
        <p className="text-sm text-text-muted mt-1">
          Saran, kendala, dan masukan umum dari mentee &amp; mentor — terpisah dari rating mentor per sesi.
        </p>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : items.length === 0 ? (
        <div className="card p-8 rounded-2xl border border-border text-center text-sm text-text-muted-2">
          Belum ada masukan.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((f) => (
            <div key={f.id} className="card p-5 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={CAT_VARIANT[f.category] || "neutral"}>{f.category}</Badge>
                <span className="text-sm font-semibold text-foreground">{f.from}</span>
                {f.anonymous && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-muted-2">
                    <Icon name="eye-off" size={12} /> anonim
                  </span>
                )}
                <span className="ml-auto text-xs text-text-muted-2">{fmtDate(f.createdAt)}</span>
              </div>
              <p className="text-sm text-text-muted-3 whitespace-pre-wrap leading-relaxed">{f.message}</p>
              {f.email && (
                <a href={`mailto:${f.email}`} className="mt-2 inline-block text-xs text-primary hover:underline">{f.email}</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
