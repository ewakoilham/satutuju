"use client";

import { useState } from "react";
import type {
  MenteeIdentitySnapshot,
  PartialMenteeIdentity,
} from "@/lib/mentee-contract-template";

/**
 * Phase 18 — mentee variant of IdentityForm. Same UX as the mentor form
 * but with the mentee identity schema (no NPWP). KTP/Paspor toggle drives
 * the idNumber field label so the placeholder hints at the right format.
 */

interface Props {
  initial: PartialMenteeIdentity;
  /** When true, fields are read-only (e.g. after signing). */
  readOnly?: boolean;
  /** Called after a successful save with the latest field set. */
  onSaved?: (next: MenteeIdentitySnapshot | PartialMenteeIdentity) => void;
}

const BASE_FIELDS: Array<{
  name: keyof MenteeIdentitySnapshot;
  label: string;
  type: "text" | "date" | "tel" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  fullWidth?: boolean;
}> = [
  { name: "fullName",     label: "Nama Lengkap (sesuai identitas)", type: "text",     placeholder: "Nama yang tertera di KTP/Paspor" },
  { name: "placeOfBirth", label: "Tempat Lahir",                    type: "text",     placeholder: "mis. Jakarta" },
  { name: "dateOfBirth",  label: "Tanggal Lahir",                   type: "date" },
  { name: "idType",       label: "Jenis Identitas",                 type: "select",   options: ["KTP", "Paspor"] },
  { name: "idNumber",     label: "Nomor Identitas",                 type: "text",     placeholder: "16 digit untuk KTP / nomor paspor" },
  { name: "phoneNumber",  label: "Nomor HP / WhatsApp",             type: "tel",      placeholder: "+62…" },
  { name: "legalAddress", label: "Alamat (sesuai identitas)",       type: "textarea", placeholder: "Alamat lengkap dengan kode pos", fullWidth: true },
];

export default function MenteeIdentityForm({
  initial,
  readOnly = false,
  onSaved,
}: Props) {
  const [state, setState] = useState<PartialMenteeIdentity>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function update<K extends keyof MenteeIdentitySnapshot>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  // idType selection drives the idNumber placeholder dynamically.
  const idType = state.idType ?? "";
  const FIELDS = BASE_FIELDS.map((f) =>
    f.name === "idNumber"
      ? {
          ...f,
          label: idType === "Paspor" ? "Nomor Paspor" : "Nomor KTP",
          placeholder:
            idType === "Paspor"
              ? "Nomor paspor (huruf + 7 digit)"
              : "16 digit KTP",
        }
      : f,
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mentee-contract/identity", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan");
      setSavedAt(new Date());
      onSaved?.(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => {
          const value = (state[f.name] ?? "") as string;
          const wrapClass = f.fullWidth ? "md:col-span-2" : "";
          return (
            <div key={f.name} className={wrapClass}>
              <label className="block text-xs font-medium text-text-muted-2 mb-1.5">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  className="input-field w-full"
                  rows={3}
                  value={value}
                  placeholder={f.placeholder}
                  disabled={readOnly}
                  onChange={(e) => update(f.name, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  className="input-field w-full"
                  value={value}
                  disabled={readOnly}
                  onChange={(e) => update(f.name, e.target.value)}
                >
                  <option value="">— Pilih —</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  className="input-field w-full"
                  value={value}
                  placeholder={f.placeholder}
                  disabled={readOnly}
                  onChange={(e) => update(f.name, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Menyimpan…" : "Simpan Data Identitas"}
            </button>
            {savedAt && !error && (
              <span className="text-xs text-success">
                Tersimpan {savedAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
              </span>
            )}
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-danger/40 bg-danger-light/40 px-3 py-2 text-xs text-danger leading-relaxed">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
