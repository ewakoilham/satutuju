"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const { user } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }, [user, router]);

  const filtered = filter
    ? users.filter((u) => u.role === filter)
    : users;

  const ROLE_STYLES: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    mentor: "bg-blue-100 text-blue-700",
    mentee: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500 text-sm mt-1">
            All registered users on the platform
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "mentor", "mentee", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === r
                  ? "bg-[var(--primary)] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Role</th>
              <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-gray-50">
                <td className="px-3 sm:px-6 py-3 font-medium">{u.name}</td>
                <td className="px-3 sm:px-6 py-3 text-gray-500">{u.email}</td>
                <td className="px-3 sm:px-6 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      ROLE_STYLES[u.role] || ""
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-3 text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
