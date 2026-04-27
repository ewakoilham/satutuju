"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";
import { MENTORS } from "@/lib/mentors";
import MentorAvatar from "./MentorAvatar";
import EditableMentorPhoto from "./EditableMentorPhoto";

const CYCLE_MS = 6000;
const t = landingCopy.id.hero;

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // After a manual click on the avatar strip, suppress auto-advance until
  // this timestamp passes (3s after the most recent click).
  const cooldownUntilRef = useRef(0);

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
      if (Date.now() < cooldownUntilRef.current) return;
      setActiveIndex((i) => (i + 1) % MENTORS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
    cooldownUntilRef.current = Date.now() + 3000;
  }, []);
  const scrollToShowcase = useCallback(() => {
    document.getElementById("mentor-showcase")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const mentor = MENTORS[activeIndex];

  return (
    <section className="relative flex items-center bg-white overflow-hidden pt-20 pb-8 lg:pt-24 lg:pb-10">
      {/* Background photo */}
      <Image
        src="/bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover pointer-events-none select-none"
      />
      {/* Soft white wash so text stays legible over the photo */}
      <div className="absolute inset-0 bg-white/70 pointer-events-none" />

      {/* Organic gradient blobs */}
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

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 w-full relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          {/* LEFT — text takes 7 cols */}
          <div className="lg:col-span-7 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-sm text-primary-700 font-semibold shadow-sm border border-white">
              <Icon name="puzzle" size={14} />
              {t.badge}
            </div>

            <p className="mt-4 text-base lg:text-base text-primary-800/80 leading-relaxed max-w-xl">
              {t.headlineLine1}
            </p>

            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[28px] sm:text-[36px] lg:text-[44px] xl:text-[52px] font-extrabold text-primary leading-[1.05] tracking-tight max-w-2xl">
              {t.headlineLine2}
            </h1>

            <p className="mt-4 text-base text-primary-800/85 leading-relaxed max-w-lg">
              {t.subheadline}
            </p>

            {/* Compact mobile-only mentor card */}
            <CompactMentorCard mentor={mentor} />

            <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center">
              <Link
                href="/signup"
                className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-all"
              >
                {t.primaryCta}
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/95 backdrop-blur-sm text-primary font-semibold rounded-xl border border-primary-200/50 hover:bg-white hover:shadow-[var(--shadow-md)] transition-all text-sm whitespace-nowrap"
              >
                {t.secondaryCta}
              </Link>
              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-brand-yellow/40 border border-brand-yellow/60 self-start sm:self-center">
                <Icon name="graduation" size={12} className="text-primary-900" />
                <span className="text-[11px] font-bold text-primary-900 whitespace-nowrap">{t.statFree}</span>
              </div>
            </div>

            {/* Mentor avatar strip — moved into the text column */}
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-primary mb-2">
                14 Mentor dari kampus top dunia
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center -space-x-1.5 flex-wrap gap-y-2">
                  {MENTORS.map((m, i) => {
                    const isActive = i === activeIndex;
                    return (
                      <button
                        key={m.fullName}
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={`${m.fullName} — ${m.major} at ${m.university}`}
                        title={`${m.fullName} · ${m.major} · ${m.university}`}
                        className={`relative rounded-full overflow-hidden transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          isActive
                            ? "w-12 h-12 ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[var(--shadow-md)] z-10"
                            : "w-10 h-10 ring-2 ring-white opacity-90 hover:opacity-100 hover:scale-105"
                        }`}
                      >
                        {m.photo ? (
                          <EditableMentorPhoto
                            mentorId={m.id}
                            location="hero-avatar"
                            fallbackPhoto={m.photo}
                            alt={m.fullName}
                            sizes="48px"
                          />
                        ) : (
                          <MentorAvatar mentor={m} sizes="48px" initialsClassName="text-[10px]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={scrollToShowcase}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-xs font-semibold text-primary border border-primary-200/60 hover:bg-white hover:shadow-[var(--shadow-sm)] transition-all"
                >
                  {t.seeAllMentors}
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
            </div>

            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary-700/80 italic">
              {t.scrollCue}
              <Icon name="chevron-down" size={14} className="animate-bounce" />
            </p>
          </div>

          {/* RIGHT — compact mentor card, 5 cols */}
          <div className="lg:col-span-5 hidden sm:block">
            <CompactFeaturedCard
              activeIndex={activeIndex}
              onHoverChange={setPaused}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mobile-only quick mentor strip shown between the subheadline and the CTAs. */
function CompactMentorCard({ mentor }: { mentor: (typeof MENTORS)[number] }) {
  return (
    <div className="mt-6 sm:hidden flex items-center gap-3 p-3 bg-white/85 backdrop-blur-sm rounded-2xl shadow-[var(--shadow-md)] border border-primary-100/50">
      <div className={`relative w-16 h-16 rounded-xl ${mentor.color} overflow-hidden flex-shrink-0`}>
        {mentor.photo ? (
          <EditableMentorPhoto
            mentorId={mentor.id}
            location="hero-mobile"
            fallbackPhoto={mentor.photo}
            alt={mentor.fullName}
            sizes="64px"
          />
        ) : (
          <MentorAvatar mentor={mentor} sizes="64px" initialsClassName="text-lg" />
        )}
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

/**
 * Right-column compact mentor card (sm and up). 4:5 photo with a country flag
 * chip top-left and a floating credential card overlapping the bottom of the
 * photo. Cycles through MENTORS via parent state; pauses on hover.
 */
function CompactFeaturedCard({
  activeIndex,
  onHoverChange,
}: {
  activeIndex: number;
  onHoverChange: (paused: boolean) => void;
}) {
  const mentor = MENTORS[activeIndex];
  const nextIndex = (activeIndex + 1) % MENTORS.length;
  // Render only the active + next photo for the cross-fade.
  const visiblePhotos = [activeIndex, nextIndex];

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className="bg-white rounded-3xl p-4 shadow-[var(--shadow-xl)] border border-white"
    >
      <div className="relative rounded-2xl overflow-hidden aspect-[5/6] bg-primary-50">
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
              {m.photo ? (
                <EditableMentorPhoto
                  mentorId={m.id}
                  location="hero-featured"
                  fallbackPhoto={m.photo}
                  alt={m.fullName}
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 45vw, 100vw"
                  priority={i === 0}
                />
              ) : (
                <MentorAvatar
                  mentor={m}
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 45vw, 100vw"
                  initialsClassName="text-7xl"
                />
              )}
            </div>
          );
        })}

        {/* Flag chip — top-left */}
        {mentor.flagCode && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 rounded-full pl-1 pr-2.5 py-1 text-[11px] font-semibold text-primary-900 shadow-sm">
            {/* Plain <img> intentionally — flag is decorative + we don't
                want to whitelist the CDN in next.config for one image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://flagcdn.com/24x18/${mentor.flagCode}.png`}
              srcSet={`https://flagcdn.com/24x18/${mentor.flagCode}.png 1x, https://flagcdn.com/48x36/${mentor.flagCode}.png 2x`}
              width={20}
              height={15}
              alt=""
              aria-hidden
              className="rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
            />
            {mentor.country ?? ""}
          </div>
        )}

        {/* Floating credential card — overlaps the bottom of the photo */}
        <div className="absolute left-3 right-3 bottom-3 bg-white rounded-2xl p-4 shadow-[var(--shadow-lg)]">
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-primary">
            {t.featuredLabel}
          </p>
          <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-primary-900 leading-tight mt-0.5">
            {mentor.fullName}
          </p>
          <p className="text-[13px] text-primary-700 mt-1.5 font-semibold">{mentor.university}</p>
          <p className="text-[12px] text-primary-700/75">{mentor.major}</p>
          <p className="text-[12px] text-primary-700/75">{mentor.scholarship}</p>
        </div>
      </div>
    </div>
  );
}
