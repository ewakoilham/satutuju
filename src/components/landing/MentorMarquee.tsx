"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-copy";

const MENTORS = [
  { name: "Siti Nurhaliza", scholarship: "Beasiswa LPDP", university: "University of Auckland", initials: "SN", color: "bg-primary" },
  { name: "Ahmad Rizki", scholarship: "Chevening", university: "University of Oxford", initials: "AR", color: "bg-primary-700" },
  { name: "Dewi Lestari", scholarship: "Australia Awards", university: "University of Sydney", initials: "DL", color: "bg-primary-600" },
  { name: "Budi Santoso", scholarship: "Fulbright", university: "Harvard University", initials: "BS", color: "bg-primary-800" },
  { name: "Rina Kartika", scholarship: "MEXT Japan", university: "University of Tokyo", initials: "RK", color: "bg-primary-deep" },
  { name: "Fajar Pratama", scholarship: "Erasmus Mundus", university: "TU Delft", initials: "FP", color: "bg-primary-700" },
  { name: "Maya Putri", scholarship: "DAAD", university: "TU Munich", initials: "MP", color: "bg-primary" },
  { name: "Dani Wijaya", scholarship: "NZ Scholarship", university: "Victoria Univ. Wellington", initials: "DW", color: "bg-primary-600" },
];

const CARD_WIDTH = 240; // w-60 = 15rem = 240px
const GAP = 24; // gap-6
const SCROLL_AMOUNT = CARD_WIDTH + GAP;

function MentorCard({ mentor }: { mentor: typeof MENTORS[0] }) {
  return (
    <div className="flex-shrink-0 w-60 bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow duration-300 cursor-pointer group">
      {/* Avatar placeholder */}
      <div className={`h-36 ${mentor.color} flex items-center justify-center relative overflow-hidden`}>
        <span className="text-4xl font-bold text-white/70 font-[family-name:var(--font-heading)] group-hover:scale-110 transition-transform duration-300">
          {mentor.initials}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
      </div>
      {/* Info */}
      <div className="p-4">
        <h4 className="font-bold text-foreground font-[family-name:var(--font-heading)]">
          {mentor.name}
        </h4>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Icon name="graduation" size={14} className="text-primary" />
          <span className="text-xs text-primary font-medium">{mentor.scholarship}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Icon name="school" size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted">{mentor.university}</span>
        </div>
      </div>
    </div>
  );
}

export default function MentorMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const autoScrollRef = useRef<number | null>(null);
  const allMentors = [...MENTORS, ...MENTORS];
  const { lang } = useLang();
  const t = landingCopy[lang].mentorShowcase;

  // Auto-scroll logic using requestAnimationFrame for smooth pixel-level scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAutoScrolling) return;

    let lastTime = 0;
    const speed = 0.5; // pixels per frame (~30px/s at 60fps)

    const step = (time: number) => {
      if (lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += speed * (delta / 16); // normalize to ~60fps

        // Loop: when we've scrolled past the first set, jump back
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
  }, [isAutoScrolling]);

  const handleManualScroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    // Pause auto-scroll during manual interaction
    setIsAutoScrolling(false);

    el.scrollBy({
      left: direction === "right" ? SCROLL_AMOUNT : -SCROLL_AMOUNT,
      behavior: "smooth",
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsAutoScrolling(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsAutoScrolling(true);
  }, []);

  return (
    <section className="bg-primary-900 py-20 overflow-hidden relative">
      {/* Organic gradient blobs (dark variants) */}
      <div
        className="absolute -top-20 -right-32 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#233a7d", filter: "blur(100px)", opacity: 0.6 }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#2e4a9a", filter: "blur(100px)", opacity: 0.5, animationDelay: "4s", animationDirection: "reverse" }}
      />

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 relative z-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight font-[family-name:var(--font-heading)] max-w-lg">
          {t.heading}{" "}
          <span className="text-primary-300">{t.highlight}</span>
        </h2>
      </div>

      {/* Marquee container */}
      <div className="relative group/marquee" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {/* Gradient fades on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-primary-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-primary-900 to-transparent z-10 pointer-events-none" />

        {/* Left arrow */}
        <button
          onClick={() => handleManualScroll("left")}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover/marquee:opacity-40 hover:!opacity-100 hover:bg-white/20 transition-all duration-300 cursor-pointer"
          aria-label="Scroll left"
        >
          <Icon name="chevron-left" size={20} className="text-white" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => handleManualScroll("right")}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover/marquee:opacity-40 hover:!opacity-100 hover:bg-white/20 transition-all duration-300 cursor-pointer"
          aria-label="Scroll right"
        >
          <Icon name="chevron-right" size={20} className="text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-hidden px-6"
        >
          {allMentors.map((mentor, i) => (
            <MentorCard key={i} mentor={mentor} />
          ))}
        </div>
      </div>
    </section>
  );
}
