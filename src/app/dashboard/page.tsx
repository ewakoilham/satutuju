"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import MentorDashboard from "@/components/dashboards/MentorDashboard";
import MenteeDashboard from "@/components/dashboards/MenteeDashboard";

export default function DashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!user || loading) return;

    if (user.role === "mentee") {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          if (!data.profile) {
            router.push("/dashboard/onboarding");
            return;
          }
          setProfileChecked(true);
        })
        .catch(() => {
          setProfileChecked(true);
        })
        .finally(() => setCheckingProfile(false));
    } else {
      setCheckingProfile(false);
      setProfileChecked(true);
    }
  }, [user, loading, router]);

  if (loading || !user) return null;
  if (user.role === "mentee" && (checkingProfile || !profileChecked)) return null;

  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "mentor":
      return <MentorDashboard />;
    case "mentee":
      return <MenteeDashboard />;
    default:
      return <MenteeDashboard />;
  }
}
