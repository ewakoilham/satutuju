"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

const ROLE_VARIANT: Record<string, "danger" | "info" | "success"> = {
  admin: "danger",
  mentor: "info",
  mentee: "success",
};

function inviteStatus(inv: Invite): { label: string; variant: "success" | "info" | "neutral" } {
  if (inv.usedAt) return { label: "Terpakai", variant: "success" };
  if (new Date(inv.expiresAt).getTime() < Date.now()) return { label: "Kedaluwarsa", variant: "neutral" };
  return { label: "Menunggu", variant: "info" };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function InvitesPage() {
  const { user } = useUser();
  const router = useRouter();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("mentee");
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      const data = await res.json();
      setInvites(data.invites || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    if (user) load();
  }, [user, router, load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Gagal mengirim undangan." });
        return;
      }
      setMsg({ type: "success", text: `Undangan terkirim ke ${email.trim()}.` });
      setEmail("");
      await load();
    } catch {
      setMsg({ type: "error", text: "Gagal mengirim undangan. Coba lagi." });
    } finally {
      setSending(false);
    }
  }

  async function resend(inv: Invite) {
    setResendingId(inv.id);
    setMsg(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inv.email, role: inv.role }),
      });
      if (res.ok) setMsg({ type: "success", text: `Undangan dikirim ulang ke ${inv.email}.` });
      await load();
    } finally {
      setResendingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
          Undangan
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Kirim undangan untuk membuat akun. Penerima akan dapat email berisi tautan aktivasi
          (berlaku 7 hari). Hanya email yang diundang yang bisa login.
        </p>
      </div>

      {/* Send invite form */}
      <div className="card p-6 rounded-2xl border border-border mb-8">
        <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="nama@email.com"
            />
          </div>
          <div className="sm:w-44">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Peran</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-field"
            >
              <option value="mentee">Mentee</option>
              <option value="mentor">Mentor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={sending} className="btn-primary py-3 px-6 rounded-xl whitespace-nowrap">
            {sending ? "Mengirim…" : "Kirim undangan"}
          </button>
        </form>

        {msg && (
          <div
            className={`mt-4 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 ${
              msg.type === "success" ? "bg-success-light text-success" : "bg-danger-light text-danger"
            }`}
          >
            <Icon name={msg.type === "success" ? "clipboard-check" : "x"} size={14} />
            {msg.text}
          </div>
        )}
      </div>

      {/* Invite list */}
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Undangan terkirim
      </h2>

      {loading ? (
        <SkeletonTable />
      ) : invites.length === 0 ? (
        <div className="card p-8 rounded-2xl border border-border text-center text-sm text-text-muted-2">
          Belum ada undangan terkirim.
        </div>
      ) : (
        <div className="card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated/60 text-text-muted-2 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Peran</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Dikirim</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const st = inviteStatus(inv);
                const canResend = !inv.usedAt;
                return (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="px-4 py-3 text-foreground">{inv.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_VARIANT[inv.role] || "neutral"}>{inv.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted hidden sm:table-cell">{fmtDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {canResend && (
                        <button
                          onClick={() => resend(inv)}
                          disabled={resendingId === inv.id}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          {resendingId === inv.id ? "…" : "Kirim ulang"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
