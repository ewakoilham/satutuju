"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import { MENTORS } from "@/lib/mentors";
import EditableMentorPhoto from "./EditableMentorPhoto";
import { useEditPanelOpen } from "@/lib/photo-edit-context";
import { BG_PHOTOS } from "@/lib/landing-bg-photos";

/**
 * Mobile-only hero — Claude Design "V2: Hero photo + 14-cell pick sheet".
 *
 * Sibling of the desktop `HeroSection`; rendered exclusively below the lg
 * breakpoint by `LandingPage`. Reuses the same MENTORS data, copy, and
 * EditableMentorPhoto wrapper, so admin photo edits flow through to both
 * mobile and desktop without duplicating state.
 */
const CYCLE_MS = 6000;
const t = landingCopy.id.hero;

interface MobileHeroSectionProps {
  /** Background index picked server-side (matches desktop hero). */
  initialBgIndex: number;
}

export default function MobileHeroSection({ initialBgIndex }: MobileHeroSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // 3-second cooldown after manual interaction so the photo the user just
  // picked stays put long enough to be inspected.
  const cooldownUntilRef = useRef(0);
  const editPanelOpen = useEditPanelOpen();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion || editPanelOpen) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() < cooldownUntilRef.current) return;
      setActiveIndex((i) => (i + 1) % MENTORS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion, editPanelOpen]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
    cooldownUntilRef.current = Date.now() + 3000;
  }, []);

  const prev = () =>
    goTo((activeIndex - 1 + MENTORS.length) % MENTORS.length);
  const next = () => goTo((activeIndex + 1) % MENTORS.length);

  // Render only the active layer + its two neighbours. Cuts idle <Image>
  // mounts from 14 → 3 (≈80% memory + lazy-load saving) while still letting
  // adjacent prev/next swaps cross-fade smoothly.
  const visibleIndices = useMemo(() => {
    const len = MENTORS.length;
    return [
      (activeIndex - 1 + len) % len,
      activeIndex,
      (activeIndex + 1) % len,
    ];
  }, [activeIndex]);

  return (
    <section
      className="relative overflow-hidden bg-white pt-24 pb-12 px-5"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <Image
        src={BG_PHOTOS[initialBgIndex]}
        alt=""
        fill
        priority
        sizes="100vw"
        quality={90}
        className="object-cover pointer-events-none select-none"
      />
      {/* Soft white wash so text stays legible over the photo */}
      <div className="absolute inset-0 bg-white/70 pointer-events-none" />

      {/* Organic gradient blobs — same palette + animation as desktop */}
      <div
        className="absolute -top-20 -right-20 w-[600px] h-[600px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(120px)", opacity: 0.7 }}
      />
      <div
        className="absolute -bottom-32 -left-20 w-[550px] h-[550px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#d5c6ef", filter: "blur(120px)", opacity: 0.5, animationDelay: "3s", animationDirection: "reverse" }}
      />
      <div
        className="absolute top-10 left-1/4 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(100px)", opacity: 0.6, animationDelay: "5s" }}
      />
      <div
        className="absolute bottom-10 right-1/3 w-[350px] h-[350px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#b8d4ed", filter: "blur(100px)", opacity: 0.5, animationDelay: "7s", animationDirection: "reverse" }}
      />

      <div className="relative z-10 max-w-md mx-auto">
        {/* Question hook — sits above everything as the lead-in. */}
        <p className="text-center text-[14px] text-primary-800/85 leading-[1.5] mb-3 mx-auto max-w-[320px]">
          {t.headlineLine1}
        </p>

        {/* Top headline — frames the mentor card below as a meet-the-team moment. */}
        <h1 className="text-center font-[family-name:var(--font-heading)] text-[30px] sm:text-[34px] font-extrabold text-primary leading-[1.05] tracking-[-0.025em] mb-3">
          Meet our wonderful mentors.
        </h1>

        {/* Eyebrow badge — sits between the title and the photo card. */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-sm border border-primary-200/40 text-[11.5px] font-semibold text-primary-700">
            <Icon name="puzzle" size={12} />
            {t.badge}
          </div>
        </div>

        {/* Featured photo card — moved to the top so a real mentor face is
            the first thing visitors see, before any copy. Only the active
            mentor + its neighbours are mounted; cross-fade via opacity. */}
        <div className="relative rounded-[22px] overflow-hidden aspect-[4/5] bg-primary-50 mb-5 shadow-[0_12px_32px_-10px_rgba(57,88,179,0.22)]">
          {visibleIndices.map((idx) => {
            const m = MENTORS[idx];
            const isActive = idx === activeIndex;
            return (
              <div
                key={m.id}
                aria-hidden={!isActive}
                className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                  isActive ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <EditableMentorPhoto
                  mentorId={m.id}
                  location="hero-featured"
                  fallbackPhoto={m.photo ?? ""}
                  alt={m.fullName}
                  sizes="(max-width: 1024px) 100vw, 480px"
                  priority={idx === 0}
                />
                {/* Bottom gradient overlay for text legibility */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 35%, rgba(17,29,66,0.85) 100%)",
                  }}
                />
                {/* Bottom meta */}
                <div className="absolute left-4 right-4 bottom-4 text-white">
                  <h3 className="font-[family-name:var(--font-heading)] text-[22px] font-bold leading-[1.1] tracking-[-0.015em] mb-1">
                    {m.fullName}
                  </h3>
                  <p className="font-[family-name:var(--font-display-serif)] italic text-base text-brand-yellow leading-tight mb-1">
                    {m.major}
                  </p>
                  <div className="text-[12.5px] flex items-center gap-1.5 text-white/85">
                    <Icon name="graduation" size={12} />
                    <span>{m.university}</span>
                    {m.flagCode && (
                      <>
                        <span className="text-white/50">·</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://flagcdn.com/24x18/${m.flagCode}.png`}
                          width={18}
                          height={14}
                          alt=""
                          aria-hidden
                          className="rounded-[2px]"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Inline prev/next nav — overlaid on the photo, NOT inside the
              fade layers so they stay clickable during transitions. */}
          <button
            type="button"
            onClick={prev}
            aria-label="Previous mentor"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition active:scale-95 hover:bg-black/50"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next mentor"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition active:scale-95 hover:bg-black/50"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>

        {/* Decorative divider — dot trio adds visual rhythm between the
            photo card and the body copy. */}
        <div className="flex justify-center items-center gap-1.5 mb-5" aria-hidden>
          <span className="w-1 h-1 rounded-full bg-primary/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <span className="w-1 h-1 rounded-full bg-primary/30" />
        </div>

        {/* Secondary headline — italic accent on the last 2 words via
            Instrument Serif for a signature brand-voice flourish. */}
        <h2 className="text-center font-[family-name:var(--font-heading)] text-[26px] sm:text-[30px] font-extrabold text-primary leading-[1.1] tracking-[-0.02em] mb-3.5 max-w-[340px] mx-auto">
          <SplitItalicTail text={t.headlineLine2} tailWords={2} />
        </h2>

        {/* Sub — centered with a comfortable measure */}
        <p className="text-center text-[14px] text-primary-800/85 leading-[1.55] mb-6 mx-auto max-w-[340px]">
          {t.subheadline}
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-2.5 mb-4">
          <Link
            href="/signup"
            className="btn-primary inline-flex items-center justify-center gap-2 w-full min-h-[52px] rounded-[14px] text-[15px] font-bold shadow-[var(--shadow-lg)]"
          >
            {t.primaryCta}
            <Icon name="arrow-right" size={15} />
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-[14px] bg-white/95 text-primary font-semibold text-[14px] border border-primary-200/50"
          >
            {t.secondaryCta}
          </Link>
        </div>

        {/* Refundable Deposit — subtle footnote, centered */}
        <p className="text-center text-[10.5px] leading-[1.45] text-primary-700/80 font-medium max-w-[320px] mx-auto">
          *{t.statFree}
        </p>
      </div>
    </section>
  );
}

/**
 * Render `text` with the last `tailWords` words wrapped in an
 * Instrument Serif italic em — used for the signature brand-voice flourish.
 */
function SplitItalicTail({ text, tailWords }: { text: string; tailWords: number }) {
  const words = text.split(" ");
  if (words.length <= tailWords) {
    return (
      <em className="not-italic font-normal text-primary-900 font-[family-name:var(--font-display-serif)] italic">
        {text}
      </em>
    );
  }
  const head = words.slice(0, -tailWords).join(" ");
  const tail = words.slice(-tailWords).join(" ");
  return (
    <>
      {head}{" "}
      <em className="not-italic font-normal text-primary-900 font-[family-name:var(--font-display-serif)] italic">
        {tail}
      </em>
    </>
  );
}
