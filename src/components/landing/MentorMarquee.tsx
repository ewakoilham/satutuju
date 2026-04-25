"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-copy";
import mentorsData from "@/data/mentors.json";
import MentorBioModal, { type MentorBio } from "./MentorBioModal";

const MENTORS = [
  { name: "Akmal Firmansyah", major: "MPhil Earth Sciences", university: "University of Cambridge", initials: "AF", color: "bg-primary", photo: "/mentors/akmal-firmansyah.jpg" },
  { name: "Buna Rizal Rachman", major: "Master of Energy", university: "University of Auckland", initials: "BR", color: "bg-primary-700", photo: "/mentors/buna-rizal-rachman-v2.jpg" },
  { name: "Hanan Hakim", major: "Postgraduate Studies", university: "Imperial College London", initials: "HH", color: "bg-primary-600", photo: "/mentors/hanan-hakim.jpg" },
  { name: "Hasna Hafida", major: "MSc Biochemistry", university: "University of Edinburgh", initials: "HH", color: "bg-primary-800", photo: "/mentors/hasna-hafida-v2.jpg" },
  { name: "Muhammad Haekal Shafi", major: "Automotive Engineering", university: "University of Warwick", initials: "HS", color: "bg-primary-deep", photo: "/mentors/muhammad-haekal-shafi.jpg" },
  { name: "Muhammad Aqil Maulana", major: "Master of Information Systems", university: "University of Melbourne", initials: "AM", color: "bg-primary-700", photo: "/mentors/muhammad-aqil-maulana.jpg" },
  { name: "Fika Rizkyanti", major: "Master of Public Health", university: "University of Sydney", initials: "FR", color: "bg-primary", photo: "/mentors/fika-rizkyanti-v2.jpg" },
  { name: "Muhammad Ilham Razak", major: "Master of Business", university: "Monash University", initials: "MI", color: "bg-primary-600", photo: "/mentors/muhammad-ilham.jpg" },
  { name: "Angela Benedicta Horta", major: "Geothermal Energy", university: "University of Auckland", initials: "AH", color: "bg-primary-800", photo: "/mentors/angela-benedicta-horta.jpg" },
  { name: "Raihan Bagus Sakti Aji", major: "Postgraduate Studies", university: "TU Delft", initials: "RA", color: "bg-primary-deep", photo: "/mentors/raihan-bagus-sakti-aji.jpg" },
  { name: "Arifansyah Wicaksono", major: "Master of Cybersecurity", university: "Monash University", initials: "AW", color: "bg-primary-700", photo: "/mentors/arifansyah-wicaksono.jpg" },
  { name: "Isna Arifah Rahmawati", major: "Master of Biomedical Science", university: "University of Sydney", initials: "IR", color: "bg-primary", photo: "/mentors/isna-arifah-rahmawati-v2.jpg" },
  { name: "Megawati Refra", major: "Postgraduate Studies", university: "Monash University", initials: "MR", color: "bg-primary-600", photo: "/mentors/megawati-refra.jpg" },
  { name: "Nyoman Krisna", major: "Master of Business", university: "Monash University", initials: "NK", color: "bg-primary-800", photo: "/mentors/nyoman-krisna-v2.jpg" as string | null },
];

const CARD_WIDTH = 240; // w-60 = 15rem = 240px
const GAP = 24; // gap-6
const SCROLL_AMOUNT = CARD_WIDTH + GAP;

function MentorCard({ mentor, onClick }: { mentor: typeof MENTORS[0]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 w-60 bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow duration-300 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {/* Avatar — photo if available, initials fallback */}
      <div className={`h-36 ${mentor.color} flex items-center justify-center relative overflow-hidden`}>
        {mentor.photo ? (
          <Image
            src={mentor.photo}
            alt={mentor.name}
            fill
            sizes="240px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="text-4xl font-bold text-white/70 font-[family-name:var(--font-heading)] group-hover:scale-110 transition-transform duration-300">
            {mentor.initials}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
      {/* Info */}
      <div className="p-4">
        <h4 className="font-bold text-foreground font-[family-name:var(--font-heading)]">
          {mentor.name}
        </h4>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Icon name="graduation" size={14} className="text-primary" />
          <span className="text-xs text-primary font-medium">{mentor.major}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Icon name="school" size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted">{mentor.university}</span>
        </div>
      </div>
    </button>
  );
}

export default function MentorMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [selectedMentor, setSelectedMentor] = useState<MentorBio | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const allMentors = [...MENTORS, ...MENTORS];
  const { lang } = useLang();
  const t = landingCopy[lang].mentorShowcase;

  // Auto-scroll logic using requestAnimationFrame for smooth pixel-level scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAutoScrolling || selectedMentor) return;

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
  }, [isAutoScrolling, selectedMentor]);

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

  const handleCardClick = useCallback((name: string) => {
    const bio = (mentorsData as MentorBio[]).find((m) => m.fullName === name);
    if (bio) setSelectedMentor(bio);
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
            <MentorCard key={i} mentor={mentor} onClick={() => handleCardClick(mentor.name)} />
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
