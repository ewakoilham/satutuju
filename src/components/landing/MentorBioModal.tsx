"use client";

import Image from "next/image";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";

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

  if (!mentor) return null;

  const awards = splitAwards(mentor.scholarshipRaw);
  const location = [mentor.university, mentor.country].filter(Boolean).join(", ");

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <div className="-mx-6 -my-3 max-h-[85vh] overflow-y-auto">
        {/* Header band with avatar */}
        <div className="relative bg-gradient-to-br from-primary-700 to-primary-900 px-6 pt-6 pb-16">
          <button
            onClick={onClose}
            aria-label={t.close}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="px-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary-700 ring-4 ring-surface flex-shrink-0 relative">
              {mentor.avatarPath ? (
                <Image
                  src={mentor.avatarPath}
                  alt={mentor.fullName}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white/80 font-[family-name:var(--font-heading)]">
                  {mentor.initials}
                </span>
              )}
            </div>
            <div className="sm:pb-2 min-w-0">
              <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)] leading-tight break-words">
                {mentor.fullName}
              </h2>
              <p className="text-sm text-text-muted mt-0.5">@{mentor.nickname}</p>
            </div>
          </div>

          {/* Quick facts row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Icon name="graduation" size={12} />
              {mentor.major}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated text-text-muted text-xs">
              <Icon name="school" size={12} />
              {location}
            </span>
            {mentor.hometown && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated text-text-muted text-xs">
                {t.from}: {mentor.hometown}
              </span>
            )}
          </div>

          {/* Body sections */}
          <div className="mt-6 space-y-5 pb-6">
            {mentor.achievement && (
              <Section label={t.achievement}>
                <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 text-sm text-foreground leading-relaxed">
                  {mentor.achievement}
                </div>
              </Section>
            )}

            {mentor.message && (
              <Section label={t.message}>
                <blockquote className="border-l-4 border-primary-300 pl-4 italic text-sm text-foreground leading-relaxed">
                  &ldquo;{mentor.message}&rdquo;
                </blockquote>
              </Section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Section label={t.currentStudies}>
                <p className="text-sm text-foreground leading-relaxed">{mentor.currentStudiesRaw}</p>
              </Section>
              <Section label={t.undergrad}>
                <p className="text-sm text-foreground leading-relaxed">{mentor.s1}</p>
              </Section>
            </div>

            {awards.length > 0 && (
              <Section label={t.awards}>
                <ul className="space-y-1.5">
                  {awards.map((line, i) => (
                    <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                      <span className="text-primary mt-1 flex-shrink-0">•</span>
                      <span>{line}</span>
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
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted-2 mb-2">
        {label}
      </h3>
      {children}
    </div>
  );
}
