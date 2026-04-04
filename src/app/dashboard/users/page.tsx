"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  hasActivePairing: boolean;
}

const ROLE_BADGE_VARIANT: Record<string, "danger" | "info" | "success"> = {
  admin: "danger",
  mentor: "info",
  mentee: "success",
};

export default function UsersPage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get("filter") || "");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setLoading(false);
      });
  }, [user, router]);

  async function deleteUser(u: UserRow) {
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete user");
      } else {
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
      }
    } catch {
      alert("Network error");
    }
    setDeletingId(null);
    setConfirmUser(null);
  }

  const filtered = filter ? users.filter((u) => u.role === filter) : users;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Users</h1>
          <p className="text-gray-500 text-sm mt-1">
            All registered users on the platform
          </p>
        </div>
        <div className="bg-gray-100 rounded-xl p-1 flex flex-wrap gap-0.5">
          {["", "mentor", "mentee", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === r
                  ? "bg-brand-blue-soft text-primary"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {r || "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-left">
                <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Email</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Role</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Joined</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-3 sm:px-6 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-gray-500">{u.email}</td>
                  <td className="px-3 sm:px-6 py-3">
                    <Badge variant={ROLE_BADGE_VARIANT[u.role] || "neutral"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 sm:px-6 py-3">
                    {u.id !== user?.userId && (
                      <button
                        onClick={() => setConfirmUser(u)}
                        disabled={deletingId === u.id || u.hasActivePairing}
                        className={`p-1.5 rounded-lg transition disabled:opacity-40 ${u.hasActivePairing ? "cursor-not-allowed" : "hover:bg-red-50"}`}
                        title={u.hasActivePairing ? "Cannot delete \u2014 user has an active pairing" : "Delete user"}
                      >
                        {deletingId === u.id
                          ? <span className="text-xs text-red-400">...</span>
                          : <Icon name="trash" className="text-red-400" size={16} />
                        }
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmUser}
        onClose={() => setConfirmUser(null)}
        onConfirm={() => {
          if (confirmUser) deleteUser(confirmUser);
        }}
        title={`Delete ${confirmUser?.name || "user"}?`}
        description={confirmUser ? `Permanently delete ${confirmUser.name} (${confirmUser.email})?\n\nThis will remove the user and all their associated pairings, sessions, and documents. This cannot be undone.` : ""}
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId === confirmUser?.id}
      />
    </div>
  );
}
