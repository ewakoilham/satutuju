"use client";

import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { MENTORS } from "@/lib/mentors";
import type { DbMentor } from "@/lib/mentors-runtime";

type Row = {
  source: "static" | "db";
  id: string;
  fullName: string;
  university: string;
  major: string;
  country?: string;
  isActive?: boolean;
  avatarPath: string | null;
};

export default function AdminMentorsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [dbMentors, setDbMentors] = useState<DbMentor[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/mentors")
      .then((r) => (r.ok ? r.json() : { mentors: [] }))
      .then((d: { mentors: DbMentor[] }) => setDbMentors(d.mentors ?? []))
      .catch(() => setDbMentors([]));
  }, []);

  if (authLoading || dbMentors === null) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (user && user.role !== "admin") return null;

  const rows: Row[] = [
    ...MENTORS.map(
      (m): Row => ({
        source: "static",
        id: m.id,
        fullName: m.fullName,
        university: m.university,
        major: m.major,
        country: m.country,
        avatarPath: m.photo,
      }),
    ),
    ...dbMentors.map(
      (d): Row => ({
        source: "db",
        id: d.id,
        fullName: d.fullName,
        university: d.university,
        major: d.major,
        country: d.country,
        isActive: d.isActive,
        avatarPath: d.avatarPath,
      }),
    ),
  ];

  async function handleDelete(id: string) {
    if (!confirm("Hide this mentor from the landing page? You can re-enable later.")) return;
    setBusyId(id);
    const res = await fetch(`/api/mentors/${id}`, { method: "DELETE", credentials: "include" });
    setBusyId(null);
    if (!res.ok) {
      alert("Failed to delete");
      return;
    }
    setDbMentors((prev) => (prev ?? []).filter((d) => d.id !== id));
  }

  async function handleReactivate(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/mentors/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    setBusyId(null);
    if (!res.ok) {
      alert("Failed to reactivate");
      return;
    }
    const data = (await res.json()) as { mentor: DbMentor };
    setDbMentors((prev) => (prev ?? []).map((d) => (d.id === id ? data.mentor : d)));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Mentors
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage every mentor that appears on the landing page hero, marquee, and bio modal.
          </p>
        </div>
        <Link
          href="/dashboard/admin/mentors/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-600 transition"
        >
          <Icon name="plus" size={16} />
          New mentor
        </Link>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated/60 text-text-muted-2 text-[11px] uppercase tracking-[0.12em]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Mentor</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">University</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Major</th>
              <th className="text-left px-4 py-3 font-semibold">Source</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}-${r.id}`} className="border-t border-border/60 hover:bg-surface-elevated/40 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-primary-50">
                      {r.avatarPath ? (
                        <Image
                          src={r.avatarPath}
                          alt={r.fullName}
                          fill
                          sizes="40px"
                          className="object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-primary-700">
                          {r.fullName
                            .split(" ")
                            .slice(0, 2)
                            .map((p) => p[0])
                            .join("")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{r.fullName}</p>
                      {r.country && (
                        <p className="text-[11px] text-text-muted-2 truncate">{r.country}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted hidden md:table-cell">
                  <p className="truncate max-w-[220px]">{r.university}</p>
                </td>
                <td className="px-4 py-3 text-text-muted hidden lg:table-cell">
                  <p className="truncate max-w-[260px]">{r.major}</p>
                </td>
                <td className="px-4 py-3">
                  {r.source === "static" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-[10px] font-semibold text-primary-700 uppercase tracking-wide">
                      Seed
                    </span>
                  ) : r.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-light text-[10px] font-semibold text-success uppercase tracking-wide">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                      Hidden
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.source === "static" ? (
                    <span className="text-[11px] text-text-muted-2 italic">read-only</span>
                  ) : (
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/admin/mentors/${r.id}`}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary-50 transition"
                      >
                        Edit
                      </Link>
                      {r.isActive ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleDelete(r.id)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                        >
                          Hide
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReactivate(r.id)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-success hover:bg-success-light transition disabled:opacity-40"
                        >
                          Show
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted-2">
        Seed mentors live in <code className="font-mono">mentors.json</code> and require a code change. Use
        the <strong>+ New mentor</strong> button to add admin-managed mentors that appear automatically
        on the live landing page.
      </p>
    </div>
  );
}
