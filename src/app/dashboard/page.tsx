"use client";

import { useUser } from "@/lib/hooks";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import MentorDashboard from "@/components/dashboards/MentorDashboard";
import MenteeDashboard from "@/components/dashboards/MenteeDashboard";

export default function DashboardPage() {
  const { user, loading } = useUser();

  if (loading || !user) return null;

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
