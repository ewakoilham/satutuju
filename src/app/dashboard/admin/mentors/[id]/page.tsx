"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import MentorForm from "@/components/admin/MentorForm";
import type { DbMentor } from "@/lib/mentors-runtime";

export default function EditMentorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useUser();
  const router = useRouter();
  const [mentor, setMentor] = useState<DbMentor | null | "missing">(null);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetch("/api/mentors")
      .then((r) => (r.ok ? r.json() : { mentors: [] }))
      .then((d: { mentors: DbMentor[] }) => {
        const found = (d.mentors ?? []).find((m) => m.id === id);
        setMentor(found ?? "missing");
      })
      .catch(() => setMentor("missing"));
  }, [id, user]);

  if (loading || mentor === null) {
    return <div className="skeleton h-72 w-full rounded-2xl" />;
  }
  if (!user || user.role !== "admin") return null;

  if (mentor === "missing") {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 text-center">
        <p className="text-foreground font-semibold">Mentor not found</p>
        <p className="text-sm text-text-muted mt-1">
          This admin-managed mentor has been removed or never existed.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/mentors")}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
        >
          Back to mentors
        </button>
      </div>
    );
  }

  return <MentorForm mode="edit" initial={mentor} />;
}
