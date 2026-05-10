"use client";

import { useState } from "react";
import type { PartialIdentity, IdentitySnapshot } from "@/lib/contract-template";

interface IdentityFormProps {
  initial: PartialIdentity;
  /** When true, fields are read-only (e.g. after signing). */
  readOnly?: boolean;
  /** Called after a successful save with the latest field set. */
  onSaved?: (next: IdentitySnapshot | PartialIdentity) => void;
}

const FIELDS: Array<{
  name: keyof IdentitySnapshot;
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
  { name: "idNumber",     label: "Nomor KTP / Paspor",              type: "text",     placeholder: "16 digit untuk KTP" },
  { name: "npwp",         label: "NPWP",                            type: "text",     placeholder: "00.000.000.0-000.000" },
  { name: "phoneNumber",  label: "Nomor HP / WhatsApp",             type: "tel",      placeholder: "+62…" },
  { name: "legalAddress", label: "Alamat Resmi (sesuai KTP/Paspor)", type: "textarea", placeholder: "Alamat lengkap dengan kode pos", fullWidth: true },
];

export default function IdentityForm({ initial, readOnly = false, onSaved }: IdentityFormProps) {
  const [state, setState] = useState<PartialIdentity>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function update<K extends keyof IdentitySnapshot>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mentor-contract/identity", {
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
                  className="form-input w-full"
                  rows={3}
                  value={value}
                  placeholder={f.placeholder}
                  disabled={readOnly}
                  onChange={(e) => update(f.name, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  className="form-input w-full"
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
                  className="form-input w-full"
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
                Tersimpan {savedAt.toLocaleTimeString("id-ID")}
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

      <style jsx>{`
        .form-input {
          padding: 0.55rem 0.75rem;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--foreground);
          border-radius: 0.5rem;
          font-size: 0.9rem;
          line-height: 1.4;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgb(57 88 179 / 0.18);
        }
        .form-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
