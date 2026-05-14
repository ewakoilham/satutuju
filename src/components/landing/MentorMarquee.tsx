"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import mentorsData from "@/data/mentors.json";
import dynamic from "next/dynamic";
import type { MentorBio } from "./MentorBioModal";

// Modal only opens on mentor card click — defer its JS until needed.
const MentorBioModal = dynamic(() => import("./MentorBioModal"), {
  ssr: false,
});
import { type Mentor } from "@/lib/mentors";
import EditableMentorPhoto from "./EditableMentorPhoto";
import {
  useAllMentors,
  useEditPanelOpen,
  useMentorNickname,
} from "@/lib/photo-edit-context";
import type { MergedMentor } from "@/lib/mentors-runtime";

/**
 * Cinematic dark-stage card — full-bleed photo with metadata overlaid at the
 * bottom and a yellow "Baca cerita" hover pill.
 */
function MentorCard({
  mentor,
  onClick,
}: {
  mentor: Mentor;
  onClick: () => void;
}) {
  const nickname = useMentorNickname(mentor.id, mentor.nickname);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/card relative flex-shrink-0 w-[280px] h-[420px] rounded-3xl overflow-hidden cursor-pointer text-left bg-primary-900 border border-white/10 transition-[transform,border-color] duration-300 hover:-translate-y-1.5 hover:border-[#fef3d0]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fef3d0]"
    >
      {/* Photo */}
      {mentor.photo && (
        <EditableMentorPhoto
          mentorId={mentor.id}
          location="marquee-card"
          fallbackPhoto={mentor.photo}
          alt={mentor.fullName}
          sizes="280px"
        />
      )}
      {/* Bottom-up gradient for text legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 35%, rgba(17,29,66,0.25) 60%, rgba(17,29,66,0.95) 100%)",
        }}
      />

      {/* Flag chip (top-right) */}
      {mentor.flagCode && (
        <span className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-primary-900/55 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/24x18/${mentor.flagCode}.png`}
            srcSet={`https://flagcdn.com/24x18/${mentor.flagCode}.png 1x, https://flagcdn.com/48x36/${mentor.flagCode}.png 2x`}
            width={18}
            height={14}
            alt=""
            aria-hidden
            className="rounded-[2px]"
          />
          {mentor.country}
        </span>
      )}

      {/* Meta block — visible by default, hides on hover */}
      <div className="absolute left-[18px] right-[18px] bottom-[18px] z-[2] transition-all duration-200 group-hover/card:opacity-0 group-hover/card:-translate-y-2">
        <h3 className="font-[family-name:var(--font-heading)] text-[22px] font-bold text-white leading-[1.15] tracking-[-0.01em] mb-2">
          {mentor.fullName}
        </h3>
        <p className="text-[16px] italic font-normal leading-[1.3] mb-1.5 text-[#fef3d0] font-[family-name:var(--font-display-serif)]">
          {mentor.major}
        </p>
        <div className="flex items-center gap-1.5 text-[12px] text-white/70">
          <Icon name="graduation" size={11} />
          <span className="line-clamp-1">{mentor.university}</span>
        </div>
      </div>

      {/* Hover-revealed CTA pill (yellow) */}
      <div className="absolute left-[18px] right-[18px] bottom-[18px] z-[3] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#fef3d0] text-primary-900 text-[12.5px] font-semibold opacity-0 translate-y-2 transition-all duration-200 group-hover/card:opacity-100 group-hover/card:translate-y-0">
        <span>Kenalan sama {nickname}</span>
        <Icon name="arrow-right" size={14} />
      </div>
    </button>
  );
}

export default function MentorMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedMentor, setSelectedMentor] = useState<MentorBio | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  // After a manual nav-arrow click we briefly pause auto-scroll so the smooth
  // scrollBy can complete without RAF fighting it.
  const pauseUntilRef = useRef(0);
  const liveMentors = useAllMentors();
  const allMentors = [...liveMentors, ...liveMentors];
  const t = landingCopy.id.mentorShowcase;
  const editPanelOpen = useEditPanelOpen();

  useEffect(() => {
    const el = scrollRef.current;
    // Pause when the bio modal or any photo edit panel is open so the card
    // the admin is editing stays put.
    if (!el || selectedMentor || editPanelOpen) return;

    let lastTime = 0;
    const speed = 0.7;

    const step = (time: number) => {
      if (lastTime && Date.now() >= pauseUntilRef.current) {
        const delta = time - lastTime;
        el.scrollLeft += speed * (delta / 16);
        const halfWidth = el.scrollWidth / 2;
        if (el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }
      lastTime = time;
      autoScrollRef.current = requestAnimationFrame(step);
    };

    autoScrollRef.current = requestAnimationFrame(step);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, [selectedMentor, editPanelOpen]);

  const handleCardClick = useCallback((mentor: MergedMentor) => {
    // Static seed mentors source their bio from mentors.json; admin-added
    // mentors carry the bio directly on the merged object.
    if (mentor.dbSource === "db") {
      setSelectedMentor({
        id: mentor.id,
        fullName: mentor.fullName,
        nickname: mentor.nickname,
        initials: mentor.initials,
        hometown: mentor.hometown ?? "",
        university: mentor.university,
        country: mentor.country ?? "",
        scholarship: mentor.scholarship,
        major: mentor.major,
        achievement: mentor.achievement ?? "",
        message: mentor.message ?? "",
        currentStudiesRaw: mentor.currentStudiesRaw ?? "",
        s1: mentor.s1 ?? "",
        scholarshipRaw: mentor.scholarshipRaw ?? "",
        avatarPath: mentor.photo,
        galleryPaths: mentor.galleryPaths,
      });
      return;
    }
    const bio = (mentorsData as MentorBio[]).find((m) => m.fullName === mentor.fullName);
    if (bio) setSelectedMentor(bio);
  }, []);

  const scrollByCards = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    // Pause auto-scroll for 800ms so the smooth scroll lands cleanly.
    pauseUntilRef.current = Date.now() + 800;
    // Card width 280 + gap 18 = 298 per card. Scroll by ~2 cards for a punchier nav.
    el.scrollBy({ left: direction * 298 * 2, behavior: "smooth" });
  }, []);

  return (
    <section
      id="mentor-showcase"
      className="relative overflow-hidden scroll-mt-20 py-20 lg:py-24 text-white"
      style={{
        background:
          "radial-gradient(1200px 600px at 80% -10%, #1a2d60 0%, transparent 60%), radial-gradient(900px 500px at -10% 110%, #233a7d 0%, transparent 55%), #111d42",
      }}
    >
      {/* Brand illustrations */}
      <Image
        src="/illustrations/puzzle-piece.png"
        alt=""
        width={100}
        height={100}
        className="absolute top-8 right-16 opacity-[0.04] pointer-events-none animate-float hidden lg:block"
      />
      <Image
        src="/illustrations/notebook.png"
        alt=""
        width={80}
        height={80}
        className="absolute bottom-8 left-16 opacity-[0.04] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "2s" }}
      />

      {/* Header */}
      <div className="max-w-[980px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 text-center relative z-10">
        <div className="inline-flex items-center px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.18em] uppercase mb-6"
          style={{ color: "#c6ddef", background: "rgba(198,221,239,0.08)", border: "1px solid rgba(198,221,239,0.18)" }}
        >
          Mentor kami berasal dari kampus impian kamu
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-[44px] xl:text-[52px] font-bold leading-[1.05] tracking-[-0.02em]">
          {t.heading}
        </h2>
        <p className="mt-5 text-base sm:text-[17px] leading-[1.55] text-white/75 max-w-xl mx-auto">
          {t.highlight}
        </p>
      </div>

      {/* Rail */}
      <div className="relative group/marquee z-10">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-primary-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-primary-900 to-transparent z-10 pointer-events-none" />

        {/* Manual nav arrows — fade in on rail hover */}
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          aria-label="Mentor sebelumnya"
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white opacity-0 group-hover/marquee:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          aria-label="Mentor berikutnya"
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white opacity-0 group-hover/marquee:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
        >
          <Icon name="arrow-right" size={16} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-[18px] overflow-x-hidden px-6 sm:px-10 lg:px-14 py-3"
        >
          {allMentors.map((mentor, i) => (
            <MentorCard
              key={i}
              mentor={mentor}
              onClick={() => handleCardClick(mentor)}
            />
          ))}
        </div>
      </div>

      <MentorBioModal
        mentor={selectedMentor}
        open={!!selectedMentor}
        onClose={() => setSelectedMentor(null)}
      />
    </section>
  );
}
