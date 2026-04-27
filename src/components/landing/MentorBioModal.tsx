"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import { getMentorPhotos } from "@/lib/mentors";

export interface MentorBio {
  id: string;
  fullName: string;
  nickname: string;
  initials: string;
  hometown: string;
  university: string;
  country: string;
  scholarship: string;
  major: string;
  achievement: string;
  message: string;
  currentStudiesRaw: string;
  s1: string;
  scholarshipRaw: string;
  avatarPath: string | null;
}

interface MentorBioModalProps {
  mentor: MentorBio | null;
  open: boolean;
  onClose: () => void;
}

function splitAwards(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
}

export default function MentorBioModal({ mentor, open, onClose }: MentorBioModalProps) {
  const t = landingCopy.id.mentorBio;

  // Build the photo gallery — gallery photos first, fall back to avatarPath.
  const photos = useMemo(() => {
    if (!mentor) return [];
    const gallery = getMentorPhotos(mentor.id);
    if (gallery.length > 0) return gallery;
    return mentor.avatarPath ? [mentor.avatarPath] : [];
  }, [mentor]);

  const [activePhoto, setActivePhoto] = useState(0);

  // Reset active photo when the mentor changes.
  useEffect(() => {
    setActivePhoto(0);
  }, [mentor?.id]);

  if (!mentor) return null;

  const awards = splitAwards(mentor.scholarshipRaw);
  const subtitle = [mentor.major, mentor.university].filter(Boolean).join(" · ");
  const currentPhoto = photos[activePhoto];

  return (
    <Modal open={open} onClose={onClose} size="2xl">
      <div className="-mx-6 -my-3 max-h-[88vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface/90 backdrop-blur-sm flex items-center justify-center text-text-muted hover:text-foreground hover:bg-surface transition shadow-sm"
        >
          <Icon name="x" size={16} />
        </button>

        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Photo gallery */}
          <div className="flex flex-col bg-surface-elevated">
            <div className="relative md:aspect-auto aspect-[4/5] md:min-h-[480px] overflow-hidden">
              {currentPhoto ? (
                <Image
                  src={currentPhoto}
                  alt={mentor.fullName}
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover object-top transition-opacity duration-300"
                  key={currentPhoto}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-text-muted-2 font-[family-name:var(--font-heading)]">
                  {mentor.initials}
                </div>
              )}
              {photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md text-[11px] font-semibold text-white">
                  {activePhoto + 1} / {photos.length}
                </div>
              )}
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-surface-elevated">
                {photos.map((src, i) => {
                  const active = i === activePhoto;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActivePhoto(i)}
                      aria-label={`Foto ${i + 1}`}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                        active
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-elevated"
                          : "opacity-65 hover:opacity-100"
                      }`}
                    >
                      <Image src={src} alt="" fill sizes="64px" className="object-cover object-top" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-8 md:px-10 py-8 md:py-10 flex flex-col">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted-2 mb-3">
              Mentor · @{mentor.nickname}
            </p>

            <h2 className="font-[family-name:var(--font-display-serif)] text-4xl md:text-5xl leading-[1.05] text-foreground tracking-tight">
              {mentor.fullName}
            </h2>

            <p className="mt-3 text-sm text-text-muted leading-relaxed">{subtitle}</p>

            {mentor.hometown && (
              <p className="mt-1 text-sm text-text-muted-2">
                {t.from} {mentor.hometown}
              </p>
            )}

            {mentor.message && (
              <figure className="mt-8 mb-2">
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-display-serif)] text-6xl leading-none text-primary/40 block -mb-3"
                >
                  &ldquo;
                </span>
                <blockquote className="font-[family-name:var(--font-display-serif)] italic text-xl md:text-2xl leading-snug text-foreground">
                  {mentor.message}
                </blockquote>
              </figure>
            )}

            {mentor.achievement && (
              <Section label={t.achievement}>
                <p className="text-[0.95rem] text-foreground leading-relaxed">
                  {mentor.achievement}
                </p>
              </Section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Section label={t.currentStudies}>
                <p className="text-[0.95rem] text-foreground leading-relaxed">
                  {mentor.currentStudiesRaw}
                </p>
              </Section>
              <Section label={t.undergrad}>
                <p className="text-[0.95rem] text-foreground leading-relaxed">{mentor.s1}</p>
              </Section>
            </div>

            {awards.length > 0 && (
              <Section label={t.awards}>
                <ul className="divide-y divide-border/60">
                  {awards.map((line, i) => (
                    <li
                      key={i}
                      className="py-2 text-[0.9rem] text-foreground leading-relaxed first:pt-0"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 pt-7 border-t border-border/60">
      <h3 className="text-xs font-medium tracking-wide text-text-muted-2 mb-3">{label}</h3>
      {children}
    </section>
  );
}
