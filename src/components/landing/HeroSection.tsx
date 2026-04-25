"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-copy";

const MENTORS = [
  { name: "Akmal F.", scholarship: "Beasiswa LPDP", university: "University of Cambridge", initials: "AF", color: "bg-primary" },
  { name: "Buna R.", scholarship: "Beasiswa LPDP", university: "University of Auckland", initials: "BR", color: "bg-primary-700" },
  { name: "Hanan H.", scholarship: "Imperial Scholarship", university: "Imperial College London", initials: "HH", color: "bg-primary-600" },
  { name: "Hasna H.", scholarship: "Beasiswa LPDP", university: "University of Edinburgh", initials: "HH", color: "bg-primary-800" },
];

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { lang } = useLang();
  const t = landingCopy[lang].hero;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % MENTORS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex items-center bg-white overflow-hidden pt-20 pb-12 lg:pt-16 lg:pb-0">
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

      {/* Decorative illustrations */}
      <Image
        src="/illustrations/puzzle-piece.png"
        alt=""
        width={160}
        height={170}
        className="absolute top-20 right-8 lg:right-20 opacity-10 pointer-events-none animate-float"
      />
      <Image
        src="/illustrations/globe.png"
        alt=""
        width={120}
        height={120}
        className="absolute bottom-20 left-8 opacity-10 pointer-events-none animate-float"
        style={{ animationDelay: "1.5s" }}
      />
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={80}
        height={80}
        className="absolute top-40 left-16 opacity-[0.07] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "0.8s" }}
      />
      <Image
        src="/illustrations/notebook.png"
        alt=""
        width={90}
        height={90}
        className="absolute bottom-32 right-1/3 opacity-[0.06] pointer-events-none animate-float hidden xl:block"
        style={{ animationDelay: "2s" }}
      />
      <Image
        src="/illustrations/open-book.png"
        alt=""
        width={70}
        height={70}
        className="absolute top-1/3 left-1/3 opacity-[0.05] pointer-events-none animate-float hidden xl:block"
        style={{ animationDelay: "3s" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-sm text-sm text-primary-700 font-medium mb-4">
              <Icon name="puzzle" size={16} />
              {t.badge}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary-900 leading-[1.15] font-[family-name:var(--font-heading)]">
              {t.headlineLine1}
              <br />
              <span className="text-primary">{t.headlineLine2}</span>
            </h1>

            <p className="mt-4 text-base lg:text-lg text-primary-800/70 max-w-lg leading-relaxed">
              {t.subheadline}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="btn-primary px-8 py-4 rounded-xl text-base font-bold shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-all"
              >
                {t.primaryCta}
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/70 backdrop-blur-sm text-primary font-semibold rounded-xl border border-primary-200/50 hover:bg-white hover:shadow-[var(--shadow-md)] transition-all text-base"
              >
                {t.secondaryCta}
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-8 flex items-center gap-8 text-sm text-primary-700/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="users" size={16} className="text-primary" />
                </div>
                <span><strong className="text-primary-900">20+</strong> {t.statMentors}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="globe" size={16} className="text-primary" />
                </div>
                <span><strong className="text-primary-900">20+</strong> {t.statCountries}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="graduation" size={16} className="text-primary" />
                </div>
                <span className="text-primary-900 font-bold">{t.statFree}</span>
              </div>
            </div>
          </div>

          {/* Right: Cycling Mentor Cards */}
          <div className="relative h-[420px] lg:h-[500px] hidden md:flex items-center justify-center">
            {MENTORS.map((mentor, i) => {
              const isActive = i === activeIndex;
              const isPrev = i === (activeIndex - 1 + MENTORS.length) % MENTORS.length;
              const isNext = i === (activeIndex + 1) % MENTORS.length;

              return (
                <div
                  key={i}
                  className="absolute transition-all duration-700 ease-in-out"
                  style={{
                    opacity: isActive ? 1 : isPrev || isNext ? 0.5 : 0,
                    transform: isActive
                      ? "translateX(0) scale(1) rotate(0deg)"
                      : isPrev
                      ? "translateX(-60px) scale(0.85) rotate(-6deg)"
                      : isNext
                      ? "translateX(60px) scale(0.85) rotate(6deg)"
                      : "translateY(40px) scale(0.7)",
                    zIndex: isActive ? 30 : isPrev || isNext ? 20 : 10,
                  }}
                >
                  <div className="w-64 bg-white rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden">
                    {/* Avatar placeholder */}
                    <div className={`h-48 ${mentor.color} flex items-center justify-center`}>
                      <span className="text-5xl font-bold text-white/80 font-[family-name:var(--font-heading)]">
                        {mentor.initials}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-bold text-foreground text-lg font-[family-name:var(--font-heading)]">
                        {mentor.name}
                      </h3>
                      <p className="text-sm text-primary font-medium mt-1">
                        {mentor.scholarship}
                      </p>
                      <p className="text-sm text-text-muted mt-0.5">
                        {mentor.university}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Dots indicator */}
            <div className="absolute bottom-4 flex gap-2">
              {MENTORS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "bg-primary w-8"
                      : "bg-primary-300 hover:bg-primary-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
