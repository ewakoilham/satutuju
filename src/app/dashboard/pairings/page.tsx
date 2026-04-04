"use client";

import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { SkeletonTable } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

export default function PairingsPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-3 w-64" />
            </div>
          </div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-5 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon="lock"
        title="Authentication Required"
        description="Please sign in to access the pairings dashboard."
      />
    );
  }

  return <AdminDashboard />;
}
