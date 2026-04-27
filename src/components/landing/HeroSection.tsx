"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import { MENTORS } from "@/lib/mentors";
import MentorAvatar from "./MentorAvatar";

const CYCLE_MS = 6000;
const t = landingCopy.id.hero;

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setActiveIndex((i) => (i + 1) % MENTORS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion]);

  const goTo = useCallback((index: number) => setActiveIndex(index), []);
  const scrollToShowcase = useCallback(() => {
    document.getElementById("mentor-showcase")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex items-center bg-white overflow-hidden pt-20 pb-12 lg:pt-20 lg:pb-12">
      {/* Background photo */}
      <Image
        src="/bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover pointer-events-none select-none"
      />
      {/* Flat brand-blue tint over the photo (no gradient, no blobs) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "#3F60B0", opacity: 0.82 }}
      />

      <Image
        src="/illustrations/puzzle-piece.png"
        alt=""
        width={140}
        height={150}
        className="absolute top-24 right-8 lg:right-12 opacity-10 pointer-events-none animate-float hidden lg:block"
      />
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={70}
        height={70}
        className="absolute top-40 left-16 opacity-[0.07] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "0.8s" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT: Text content */}
          <div className="lg:col-span-5 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm text-white font-medium mb-4 border border-white/20">
              <Icon name="puzzle" size={16} />
              {t.badge}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] xl:text-5xl font-extrabold text-white leading-[1.1] font-[family-name:var(--font-heading)] [text-shadow:0_2px_24px_rgba(0,0,0,0.18)]">
              {t.headlineLine1}
              <br />
              <span className="text-brand-yellow">{t.headlineLine2}</span>
            </h1>

            <p className="mt-3 text-base text-white/85 max-w-lg leading-relaxed">
              {t.subheadline}
            </p>

            <CompactMentorCard mentor={MENTORS[activeIndex]} />

            <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap bg-brand-yellow text-primary-900 hover:bg-brand-yellow/90 shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-all"
              >
                {t.primaryCta}
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary-900 font-bold rounded-xl border border-white hover:shadow-[var(--shadow-md)] transition-all text-sm whitespace-nowrap"
              >
                {t.secondaryCta}
              </Link>
              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-brand-yellow border border-brand-yellow self-start sm:self-center">
                <Icon name="graduation" size={12} className="text-primary-900" />
                <span className="text-[11px] font-bold text-primary-900 whitespace-nowrap">{t.statFree}</span>
              </div>
            </div>

          </div>

          {/* RIGHT: Mentor showcase */}
          <div className="lg:col-span-7 hidden sm:block">
            <FeaturedMentorPanel
              activeIndex={activeIndex}
              onHoverChange={setPaused}
              onSelectMentor={goTo}
              onSeeAll={scrollToShowcase}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactMentorCard({ mentor }: { mentor: (typeof MENTORS)[number] }) {
  return (
    <div className="mt-6 sm:hidden flex items-center gap-3 p-3 bg-white/85 backdrop-blur-sm rounded-2xl shadow-[var(--shadow-md)] border border-primary-100/50">
      <div className={`relative w-16 h-16 rounded-xl ${mentor.color} overflow-hidden flex-shrink-0`}>
        <MentorAvatar mentor={mentor} sizes="64px" initialsClassName="text-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-bold text-primary-600">
          {t.featuredLabel}
        </p>
        <p className="text-sm font-bold text-primary-900 truncate font-[family-name:var(--font-heading)]">
          {mentor.fullName}
        </p>
        <p className="text-xs text-primary-700/80 truncate">{mentor.university}</p>
        <p className="text-[11px] text-primary-600/80 truncate">{mentor.major}</p>
      </div>
    </div>
  );
}

function FeaturedMentorPanel({
  activeIndex,
  onHoverChange,
  onSelectMentor,
  onSeeAll,
}: {
  activeIndex: number;
  onHoverChange: (paused: boolean) => void;
  onSelectMentor: (i: number) => void;
  onSeeAll: () => void;
}) {
  const mentor = MENTORS[activeIndex];
  const nextIndex = (activeIndex + 1) % MENTORS.length;
  // Render only the current and next photo for the cross-fade — keeps the DOM
  // small and avoids 14 simultaneous next/image requests on mount.
  const visiblePhotos = [activeIndex, nextIndex];

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center px-1">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/90">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow animate-pulse" />
          {t.featuredLabel}
        </div>
      </div>

      <div className="relative bg-white rounded-3xl shadow-[var(--shadow-xl)] overflow-hidden border border-primary-100/40">
        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="relative md:col-span-3 aspect-[4/5] md:aspect-auto md:min-h-[360px] lg:min-h-[380px] overflow-hidden">
            {visiblePhotos.map((i) => {
              const m = MENTORS[i];
              const isActive = i === activeIndex;
              return (
                <div
                  key={m.fullName}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isActive ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  aria-hidden={!isActive}
                >
                  <MentorAvatar
                    mentor={m}
                    sizes="(min-width: 1024px) 480px, (min-width: 640px) 60vw, 100vw"
                    initialsClassName="text-7xl"
                    priority={i === 0}
                  />
                </div>
              );
            })}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          </div>

          <div className="md:col-span-2 p-5 lg:p-6 flex flex-col justify-center bg-gradient-to-br from-white to-primary-50/40">
            <h3 className="text-lg lg:text-xl font-extrabold text-primary-900 font-[family-name:var(--font-heading)] leading-tight">
              {mentor.fullName}
            </h3>
            <div className="mt-4 space-y-2.5">
              <CredentialRow icon="school" label={mentor.university} accent />
              <CredentialRow icon="graduation" label={mentor.major} />
              <CredentialRow icon="document" label={mentor.scholarship} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center -space-x-1.5 flex-wrap gap-y-2">
          {MENTORS.map((m, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={m.fullName}
                type="button"
                onClick={() => onSelectMentor(i)}
                aria-label={`${m.fullName} — ${m.major} at ${m.university}`}
                title={`${m.fullName} · ${m.major} · ${m.university}`}
                className={`relative rounded-full overflow-hidden transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                  isActive
                    ? "w-12 h-12 ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[var(--shadow-md)] z-10"
                    : "w-10 h-10 ring-2 ring-white opacity-90 hover:opacity-100 hover:scale-105"
                }`}
              >
                <MentorAvatar mentor={m} sizes="48px" initialsClassName="text-[10px]" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-xs font-semibold text-primary border border-primary-200/60 hover:bg-white hover:shadow-[var(--shadow-sm)] transition-all"
        >
          {t.seeAllMentors}
          <Icon name="arrow-right" size={12} />
        </button>
      </div>
    </div>
  );
}

function CredentialRow({
  icon,
  label,
  accent = false,
}: {
  icon: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          accent ? "bg-primary text-white" : "bg-primary-50 text-primary"
        }`}
      >
        <Icon name={icon} size={14} />
      </div>
      <p className={`text-sm leading-snug ${accent ? "font-semibold text-primary-900" : "text-primary-800/85"}`}>
        {label}
      </p>
    </div>
  );
}
