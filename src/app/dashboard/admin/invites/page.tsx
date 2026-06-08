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
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState("mentee");
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Split pasted/typed text on whitespace/comma/semicolon, add unique chips.
  function addEmails(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    setEmails((prev) => [...new Set([...prev, ...parts])]);
  }
  function removeEmail(e: string) {
    setEmails((prev) => prev.filter((x) => x !== e));
  }
  function onEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (draft.trim()) { addEmails(draft); setDraft(""); }
    } else if (e.key === "Backspace" && !draft && emails.length) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }
  function onEmailPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[\s,;]/.test(text)) { e.preventDefault(); addEmails(text); }
  }

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
    // Flush any half-typed email into a chip first.
    const all = [...new Set([...emails, ...draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)])];
    const valid = all.filter(isValidEmail);
    const invalid = all.filter((x) => !isValidEmail(x));
    if (valid.length === 0) {
      setMsg({ type: "error", text: "Masukkan minimal satu email yang valid." });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: valid, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Gagal mengirim undangan." });
        return;
      }
      const results: { email: string; status: string }[] = data.results || [];
      const sent = results.filter((r) => r.status === "sent").length;
      const reused = results.filter((r) => r.status === "reused").length;
      const failed = results.filter((r) => r.status === "error" || r.status === "invalid");
      const parts = [`${sent} undangan terkirim`];
      if (reused) parts.push(`${reused} sudah pernah diundang (dikirim ulang)`);
      if (invalid.length) parts.push(`${invalid.length} email tidak valid dilewati`);
      if (failed.length) parts.push(`${failed.length} gagal`);
      setMsg({
        type: failed.length || invalid.length ? "error" : "success",
        text: parts.join(" · "),
      });
      setEmails(invalid); // keep invalid ones so admin can fix them
      setDraft("");
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
      <button
        onClick={() => router.push("/dashboard/users")}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition mb-4"
      >
        <Icon name="arrow-left" size={15} />
        Kembali ke Users
      </button>
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
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Email <span className="text-text-muted-2 font-normal">(bisa banyak — pisah dengan koma, spasi, atau Enter)</span>
            </label>
            <div className="input-field flex flex-wrap items-center gap-1.5 min-h-[46px] h-auto py-2 cursor-text"
              onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
              {emails.map((e) => {
                const ok = isValidEmail(e);
                return (
                  <span key={e}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                      ok ? "bg-primary-50 text-primary" : "bg-danger-light text-danger"
                    }`}
                    title={ok ? undefined : "Email tidak valid"}>
                    {e}
                    <button type="button" onClick={() => removeEmail(e)} className="hover:opacity-70" aria-label="Hapus">
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={onEmailKeyDown}
                onPaste={onEmailPaste}
                onBlur={() => { if (draft.trim()) { addEmails(draft); setDraft(""); } }}
                className="flex-1 min-w-[140px] border-0 outline-none bg-transparent text-sm p-0"
                placeholder={emails.length ? "" : "nama@email.com, lainnya@email.com"}
              />
            </div>
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
            {sending ? "Mengirim…" : `Kirim undangan${emails.length > 1 ? ` (${emails.length})` : ""}`}
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
