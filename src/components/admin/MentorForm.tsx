"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import {
  type DbMentor,
  suggestInitials,
  suggestMentorId,
} from "@/lib/mentors-runtime";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  initial?: DbMentor;
}

type FormState = {
  id: string;
  fullName: string;
  nickname: string;
  initials: string;
  university: string;
  major: string;
  country: string;
  flagCode: string;
  scholarship: string;
  hometown: string;
  message: string;
  achievement: string;
  currentStudiesRaw: string;
  s1: string;
  scholarshipRaw: string;
  avatarPath: string;
  galleryPaths: string[];
  isActive: boolean;
  displayOrder: number;
};

function emptyState(): FormState {
  return {
    id: "",
    fullName: "",
    nickname: "",
    initials: "",
    university: "",
    major: "",
    country: "",
    flagCode: "",
    scholarship: "",
    hometown: "",
    message: "",
    achievement: "",
    currentStudiesRaw: "",
    s1: "",
    scholarshipRaw: "",
    avatarPath: "",
    galleryPaths: [],
    isActive: true,
    displayOrder: 100,
  };
}

function fromDb(d: DbMentor): FormState {
  return {
    id: d.id,
    fullName: d.fullName,
    nickname: d.nickname,
    initials: d.initials,
    university: d.university,
    major: d.major,
    country: d.country,
    flagCode: d.flagCode ?? "",
    scholarship: d.scholarship ?? "",
    hometown: d.hometown ?? "",
    message: d.message ?? "",
    achievement: d.achievement ?? "",
    currentStudiesRaw: d.currentStudiesRaw ?? "",
    s1: d.s1 ?? "",
    scholarshipRaw: d.scholarshipRaw ?? "",
    avatarPath: d.avatarPath ?? "",
    galleryPaths: d.galleryPaths ?? [],
    isActive: d.isActive,
    displayOrder: d.displayOrder,
  };
}

export default function MentorForm({ mode, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() =>
    initial ? fromDb(initial) : emptyState(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggest id + initials from the full name while creating.
  useEffect(() => {
    if (mode !== "create") return;
    if (!state.fullName) return;
    setState((prev) => ({
      ...prev,
      id: prev.id || suggestMentorId(prev.fullName),
      initials: prev.initials || suggestInitials(prev.fullName),
      nickname: prev.nickname || (prev.fullName.split(" ")[0] ?? ""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fullName, mode]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadFile(file: File): Promise<string | null> {
    if (!state.id) {
      setError("Set a name first so we can generate an id for the photo path.");
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/mentors/${state.id}/photo`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Upload failed (HTTP ${res.status})`);
      return null;
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function handleAvatarPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const url = await uploadFile(file);
    setBusy(false);
    if (url) set("avatarPath", url);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleGalleryPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadFile(f);
      if (url) urls.push(url);
    }
    setBusy(false);
    if (urls.length > 0) {
      set("galleryPaths", [...state.galleryPaths, ...urls]);
    }
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function removeGalleryPhoto(url: string) {
    set(
      "galleryPaths",
      state.galleryPaths.filter((p) => p !== url),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      ...state,
      flagCode: state.flagCode.trim().toLowerCase() || null,
      scholarship: state.scholarship || null,
      hometown: state.hometown || null,
      message: state.message || null,
      achievement: state.achievement || null,
      currentStudiesRaw: state.currentStudiesRaw || null,
      s1: state.s1 || null,
      scholarshipRaw: state.scholarshipRaw || null,
      avatarPath: state.avatarPath || null,
    };

    const url = mode === "create" ? "/api/mentors" : `/api/mentors/${state.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Save failed (HTTP ${res.status})`);
      return;
    }

    if (mode === "create") {
      router.push(`/dashboard/admin/mentors/${state.id}`);
    } else {
      router.refresh();
    }
  }

  // Live preview — mimics the marquee card visual on the right side of the form.
  const previewMentor = useMemo(
    () => ({
      photo: state.avatarPath || null,
      fullName: state.fullName || "Nama mentor",
      major: state.major || "Major",
      university: state.university || "University",
      country: state.country || "Country",
      flagCode: state.flagCode.toLowerCase() || null,
      initials: state.initials || "??",
    }),
    [state],
  );

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-[2fr_1fr] gap-6 animate-fade-in">
      {/* LEFT — fields */}
      <div className="space-y-5">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            {mode === "create" ? "Add new mentor" : `Edit · ${initial?.fullName}`}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin/mentors")}
              className="px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-elevated transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-600 transition disabled:opacity-50"
            >
              {busy ? "Saving…" : mode === "create" ? "Create mentor" : "Save changes"}
            </button>
          </div>
        </header>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <Section title="Identity">
          <Field label="Full name" required>
            <input
              type="text"
              required
              value={state.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className="form-input"
            />
          </Field>
          <Field
            label="ID (slug)"
            required
            help={mode === "edit" ? "Locked after creation." : "Used as the URL slug + photo folder."}
          >
            <input
              type="text"
              required
              disabled={mode === "edit"}
              pattern="^[a-z0-9-]+$"
              value={state.id}
              onChange={(e) => set("id", e.target.value)}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nickname" required>
              <input
                type="text"
                required
                value={state.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Initials" required>
              <input
                type="text"
                required
                maxLength={3}
                value={state.initials}
                onChange={(e) => set("initials", e.target.value.toUpperCase())}
                className="form-input"
              />
            </Field>
          </div>
        </Section>

        <Section title="Academics">
          <Field label="University" required>
            <input
              type="text"
              required
              value={state.university}
              onChange={(e) => set("university", e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Major" required>
            <input
              type="text"
              required
              value={state.major}
              onChange={(e) => set("major", e.target.value)}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country" required>
              <input
                type="text"
                required
                value={state.country}
                onChange={(e) => set("country", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Flag code" help="ISO 2-letter, e.g. gb, au, nz">
              <input
                type="text"
                maxLength={2}
                value={state.flagCode}
                onChange={(e) => set("flagCode", e.target.value.toLowerCase())}
                className="form-input"
              />
            </Field>
          </div>
          <Field label="Scholarship label" help='e.g. "LPDP Scholar"'>
            <input
              type="text"
              value={state.scholarship}
              onChange={(e) => set("scholarship", e.target.value)}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Bio modal content">
          <Field label="Hometown">
            <input
              type="text"
              value={state.hometown}
              onChange={(e) => set("hometown", e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Quote / pesan" help="Italic quote shown at the top of the bio modal.">
            <textarea
              rows={3}
              value={state.message}
              onChange={(e) => set("message", e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Pencapaian">
            <textarea
              rows={3}
              value={state.achievement}
              onChange={(e) => set("achievement", e.target.value)}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Studi saat ini">
              <textarea
                rows={2}
                value={state.currentStudiesRaw}
                onChange={(e) => set("currentStudiesRaw", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Pendidikan S1">
              <textarea
                rows={2}
                value={state.s1}
                onChange={(e) => set("s1", e.target.value)}
                className="form-input"
              />
            </Field>
          </div>
          <Field label="Beasiswa & penghargaan" help="One per line. Leading numbers/dots are stripped automatically.">
            <textarea
              rows={4}
              value={state.scholarshipRaw}
              onChange={(e) => set("scholarshipRaw", e.target.value)}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Photos">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Primary photo</p>
              <p className="text-[11px] text-text-muted-2 mb-2">
                Used in the avatar strip, marquee card, and as the first bio-modal photo.
              </p>
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-primary-50 flex-shrink-0">
                  {state.avatarPath ? (
                    <Image
                      src={state.avatarPath}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-base font-bold text-primary-700">
                      {state.initials || "?"}
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarPicked}
                  className="text-xs"
                  disabled={!state.id || busy}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Gallery photos</p>
              <p className="text-[11px] text-text-muted-2 mb-2">
                Extra photos for the bio modal carousel. Upload more than one at a time.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {state.galleryPaths.map((p) => (
                  <div key={p} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                    <Image src={p} alt="" fill sizes="64px" className="object-cover object-top" />
                    <button
                      type="button"
                      onClick={() => removeGalleryPhoto(p)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] grid place-items-center opacity-0 group-hover:opacity-100 transition"
                      aria-label="Remove"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleGalleryPicked}
                className="text-xs"
                disabled={!state.id || busy}
              />
            </div>
          </div>
        </Section>

        <Section title="Display">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display order" help="Lower = earlier in lists.">
              <input
                type="number"
                value={state.displayOrder}
                onChange={(e) => set("displayOrder", Number(e.target.value))}
                className="form-input"
              />
            </Field>
            <Field label="Active">
              <label className="inline-flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={state.isActive}
                  onChange={(e) => set("isActive", e.target.checked)}
                />
                <span className="text-sm">Show on landing page</span>
              </label>
            </Field>
          </div>
        </Section>
      </div>

      {/* RIGHT — live preview */}
      <aside className="space-y-3 lg:sticky lg:top-24 self-start">
        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted-2">
          Live preview
        </p>
        <div className="relative w-full max-w-[280px] h-[420px] rounded-3xl overflow-hidden bg-primary-900 border border-white/10 mx-auto">
          {previewMentor.photo ? (
            <Image
              src={previewMentor.photo}
              alt={previewMentor.fullName}
              fill
              sizes="280px"
              className="object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-5xl font-extrabold text-white/30 font-[family-name:var(--font-heading)]">
              {previewMentor.initials}
            </div>
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent 35%, rgba(17,29,66,0.25) 60%, rgba(17,29,66,0.95) 100%)",
            }}
          />
          {previewMentor.flagCode && (
            <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-primary-900/55 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/24x18/${previewMentor.flagCode}.png`}
                width={18}
                height={14}
                alt=""
                className="rounded-[2px]"
              />
              {previewMentor.country}
            </span>
          )}
          <div className="absolute left-[18px] right-[18px] bottom-[18px]">
            <h3 className="font-[family-name:var(--font-heading)] text-[22px] font-bold text-white leading-[1.15] tracking-[-0.01em] mb-2">
              {previewMentor.fullName}
            </h3>
            <p className="text-[16px] italic font-normal leading-[1.3] mb-1.5 text-[#fef3d0] font-[family-name:var(--font-display-serif)]">
              {previewMentor.major}
            </p>
            <p className="text-[12px] text-white/70 line-clamp-1">{previewMentor.university}</p>
          </div>
        </div>
        <p className="text-[11px] text-text-muted-2 text-center">
          Cards on the live landing page look exactly like this.
        </p>
      </aside>

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
          background: var(--surface, white);
          color: var(--foreground, black);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--primary, #2e4a9a);
          box-shadow: 0 0 0 3px rgba(46, 74, 154, 0.15);
        }
        .form-input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <legend className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted-2 px-2 -mb-1">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {help && <span className="block mt-1 text-[11px] text-text-muted-2">{help}</span>}
    </label>
  );
}
