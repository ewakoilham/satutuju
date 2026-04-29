"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import MentorForm from "@/components/admin/MentorForm";

export default function NewMentorPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, loading, router]);
  if (loading) return <div className="skeleton h-72 w-full rounded-2xl" />;
  if (!user || user.role !== "admin") return null;
  return <MentorForm mode="create" />;
}
