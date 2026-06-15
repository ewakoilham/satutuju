"use client";

/** "Beri masukan ke SatuTuju" — general feedback to admin (not the mentor).
 *  A trigger button + modal: category + message + optional anonymous → POST
 *  /api/feedback. Distinct from the per-session mentor rating. */

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";

const CATEGORIES = ["Saran", "Kendala", "Lainnya"] as const;

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("Saran");
  const [message, setMessage] = useState("");
  const [anon, setAnon] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  function close() {
    setOpen(false);
    // Reset after the close animation so it's fresh next time.
    setTimeout(() => { setDone(false); setMessage(""); setCategory("Saran"); setAnon(false); setErr(""); }, 200);
  }

  async function submit() {
    if (message.trim().length < 3) { setErr("Tulis masukan kamu dulu ya."); return; }
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim(), anonymous: anon }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Gagal mengirim. Coba lagi.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Gagal mengirim. Coba lagi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition hover:border-primary-200 hover:bg-surface-elevated"
      >
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
          <Icon name="chat" size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Beri masukan ke SatuTuju</span>
          <span className="block text-xs text-text-muted-2">Saran, kendala, atau apa pun soal program — bukan ke mentor.</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={close}
        title={done ? "Makasih! 🙌" : "Beri masukan ke SatuTuju"}
        description={done ? undefined : "Masukan ini ke tim SatuTuju (admin), bukan ke mentor kamu."}
        actions={
          done ? (
            <button type="button" className="db-btn db-btn-primary" onClick={close}>Tutup</button>
          ) : (
            <>
              <button type="button" className="db-btn db-btn-outline" onClick={close} disabled={sending}>Batal</button>
              <button type="button" className="db-btn db-btn-primary" onClick={submit} disabled={sending}>
                {sending ? "Mengirim…" : "Kirim masukan"}
              </button>
            </>
          )
        }
      >
        {done ? (
          <p style={{ fontSize: 14, color: "var(--text-muted-3)", lineHeight: 1.6, margin: 0 }}>
            Masukan kamu sudah terkirim ke tim SatuTuju. Kami baca semuanya 🙏
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="text-xs font-medium text-text-muted-2 block mb-1.5">Kategori</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      category === c
                        ? "border-primary bg-primary-50 text-primary"
                        : "border-border text-text-muted hover:border-primary-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted-2 block mb-1.5">Pesan</label>
              <textarea
                className="input-field w-full resize-none"
                rows={4}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setErr(""); }}
                placeholder="Ceritakan saran atau kendala kamu…"
                maxLength={2000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              Kirim sebagai anonim (nama kamu disembunyikan dari admin)
            </label>
            {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{err}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
