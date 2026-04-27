"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import mentorsData from "@/data/mentors.json";
import MentorBioModal, { type MentorBio } from "./MentorBioModal";
import { MENTORS, type Mentor } from "@/lib/mentors";
import EditableMentorPhoto from "./EditableMentorPhoto";

const CARD_WIDTH = 280; // w-[280px]
const GAP = 18;
const SCROLL_AMOUNT = CARD_WIDTH + GAP;

/**
 * Cinematic dark-stage card — full-bleed photo with metadata overlaid at the
 * bottom and a yellow "Baca cerita" hover pill.
 */
function MentorCard({
  mentor,
  index,
  onClick,
}: {
  mentor: Mentor;
  index: number;
  onClick: () => void;
}) {
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

      {/* Number badge (top-left, monospace) */}
      <span className="absolute top-4 left-4 z-10 inline-flex items-center px-2.5 py-1 rounded-full bg-primary-900/55 backdrop-blur-md border border-white/20 text-[11px] font-semibold tracking-[0.1em] text-white/85 font-[family-name:var(--font-geist-mono)]">
        № {String(index + 1).padStart(2, "0")}
      </span>

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
        <span>Baca cerita {mentor.fullName.split(" ")[0]}</span>
        <Icon name="arrow-right" size={14} />
      </div>
    </button>
  );
}

export default function MentorMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [selectedMentor, setSelectedMentor] = useState<MentorBio | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  // Direct DOM refs for the progress UI — bypasses React re-renders so the
  // bar/count update at 60fps without thrashing the marquee tree.
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressCountRef = useRef<HTMLSpanElement>(null);
  const allMentors = [...MENTORS, ...MENTORS];
  const t = landingCopy.id.mentorShowcase;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAutoScrolling || selectedMentor) return;

    let lastTime = 0;
    const speed = 0.5;

    const step = (time: number) => {
      if (lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += speed * (delta / 16);
        const halfWidth = el.scrollWidth / 2;
        if (el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
        // Update progress UI directly (no setState) — 0..1 across the first set.
        const max = halfWidth || 1;
        const p = (el.scrollLeft % max) / max;
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${Math.max(8, p * 100)}%`;
        }
        if (progressCountRef.current) {
          const idx = Math.min(MENTORS.length - 1, Math.floor(p * MENTORS.length));
          progressCountRef.current.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(MENTORS.length).padStart(2, "0")}`;
        }
      }
      lastTime = time;
      autoScrollRef.current = requestAnimationFrame(step);
    };

    autoScrollRef.current = requestAnimationFrame(step);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, [isAutoScrolling, selectedMentor]);

  const handleManualScroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAutoScrolling(false);
    el.scrollBy({
      left: direction === "right" ? SCROLL_AMOUNT : -SCROLL_AMOUNT,
      behavior: "smooth",
    });
  }, []);

  const handleCardClick = useCallback((name: string) => {
    const bio = (mentorsData as MentorBio[]).find((m) => m.fullName === name);
    if (bio) setSelectedMentor(bio);
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
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[12px] font-semibold tracking-[0.18em] uppercase mb-6"
          style={{ color: "#c6ddef", background: "rgba(198,221,239,0.08)", border: "1px solid rgba(198,221,239,0.18)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#fef3d0]" />
          14 mentor · sudah di luar negeri
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-[44px] xl:text-[52px] font-bold leading-[1.05] tracking-[-0.02em] mb-4">
          <span className="block">{t.heading}</span>
          <em
            className="block font-normal text-[#fef3d0] font-[family-name:var(--font-display-serif)] italic"
          >
            {t.highlight}
          </em>
        </h2>
        <p className="text-base sm:text-[17px] leading-[1.55] text-white/75 max-w-xl mx-auto">
          Klik kartu untuk membaca cerita lengkap setiap mentor — kampus tujuan,
          beasiswa, dan nasihat paling berharga yang pernah mereka dapat.
        </p>
      </div>

      {/* Rail */}
      <div className="relative group/marquee z-10">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-primary-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-primary-900 to-transparent z-10 pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-[18px] overflow-x-hidden px-6 sm:px-10 lg:px-14 py-3"
        >
          {allMentors.map((mentor, i) => (
            <MentorCard
              key={i}
              mentor={mentor}
              index={i % MENTORS.length}
              onClick={() => handleCardClick(mentor.fullName)}
            />
          ))}
        </div>
      </div>

      {/* Bottom nav: count + progress + arrows */}
      <div className="max-w-[980px] mx-auto px-6 sm:px-10 lg:px-14 mt-6 flex items-center gap-6 relative z-10">
        <span
          ref={progressCountRef}
          className="font-[family-name:var(--font-geist-mono)] text-[12px] tracking-[0.08em] text-white/60 whitespace-nowrap"
        >
          01 / {String(MENTORS.length).padStart(2, "0")}
        </span>
        <div className="flex-1 h-[3px] rounded-full bg-white/10 relative overflow-hidden">
          <div
            ref={progressBarRef}
            className="absolute top-0 left-0 h-full bg-[#fef3d0] rounded-full"
            style={{ width: "8%" }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleManualScroll("left")}
            aria-label="Scroll left"
            className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/[0.18] text-white flex items-center justify-center transition-all duration-200 hover:bg-[#fef3d0]/15 hover:border-[#fef3d0] hover:text-[#fef3d0]"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleManualScroll("right")}
            aria-label="Scroll right"
            className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/[0.18] text-white flex items-center justify-center transition-all duration-200 hover:bg-[#fef3d0]/15 hover:border-[#fef3d0] hover:text-[#fef3d0]"
          >
            <Icon name="chevron-right" size={16} />
          </button>
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
