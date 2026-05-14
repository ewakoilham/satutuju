"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy } from "@/lib/landing-copy";

type Copy = (typeof landingCopy)["id"];

const STEP_ICONS = ["user", "puzzle", "calendar"] as const;

function ProfileVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["profile"] }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] p-6 w-72 mx-auto">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
          <span className="text-xl font-bold text-white font-[family-name:var(--font-heading)]">MR</span>
        </div>
        {/* Name */}
        <h4 className="text-center font-bold text-foreground font-[family-name:var(--font-heading)] text-base">
          {copy.name}
        </h4>
        {/* Details */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-start gap-2.5 bg-primary-50 rounded-lg px-3 py-2.5">
            <Icon name="graduation" size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-text-muted-2 uppercase tracking-wider font-medium">{copy.targetUniLabel}</p>
              <p className="text-xs text-foreground font-medium">{copy.targetUniValue}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-brand-blue-soft rounded-lg px-3 py-2.5">
            <Icon name="document" size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-text-muted-2 uppercase tracking-wider font-medium">{copy.scholarshipLabel}</p>
              <p className="text-xs text-foreground font-medium">{copy.scholarshipValue}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-10 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-medium">{copy.cta}</span>
        </div>
      </div>
    </div>
  );
}

function MatchVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["match"] }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="flex items-center justify-center gap-2 md:gap-4">
        {/* Mentee */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white shadow-[var(--shadow-md)] flex items-center justify-center flex-shrink-0">
          <Icon name="user" size={24} className="text-primary-400 md:hidden" />
          <Icon name="user" size={28} className="text-primary-400 hidden md:block" />
        </div>
        {/* Connection animation */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary animate-pulse-glow"
              style={{ animationDelay: `${j * 0.3}s` }}
            />
          ))}
        </div>
        {/* Puzzle piece */}
        <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center flex-shrink-0">
          <Icon name="puzzle" size={32} className="text-primary animate-float md:hidden" />
          <Icon name="puzzle" size={40} className="text-primary animate-float hidden md:block" />
        </div>
        {/* Connection animation */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary animate-pulse-glow"
              style={{ animationDelay: `${j * 0.3 + 0.5}s` }}
            />
          ))}
        </div>
        {/* Mentor */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white shadow-[var(--shadow-md)] flex items-center justify-center flex-shrink-0">
          <Icon name="graduation" size={24} className="text-primary md:hidden" />
          <Icon name="graduation" size={28} className="text-primary hidden md:block" />
        </div>
      </div>
      <p className="text-center text-sm text-primary-700 mt-4 font-medium">
        {copy.caption}
      </p>
    </div>
  );
}

function CalendarVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["calendar"] }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="relative flex flex-col md:flex-row items-center md:items-start gap-4">
        {/* Calendar card - shown alongside session on md+, stacks on mobile */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] p-4 w-48 flex-shrink-0 md:mt-8">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-foreground text-xs font-[family-name:var(--font-heading)]">{copy.month}</span>
            <Icon name="calendar" size={14} className="text-primary" />
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
            {copy.dayHeaders.map((d, i) => (
              <div key={i} className="text-text-muted-2 font-medium py-0.5">{d}</div>
            ))}
            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
              <div
                key={day}
                className={`py-1 rounded text-[10px] transition-all ${
                  day === 15
                    ? "bg-primary text-white font-bold"
                    : day === 18 || day === 22
                    ? "bg-primary-100 text-primary font-medium"
                    : "text-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Mentoring session card - shown alongside calendar */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] p-5 w-64 flex-shrink-0">
          {/* Video call header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-semibold text-success">{copy.live}</span>
            </div>
            <span className="text-[10px] text-text-muted-2">45:12</span>
          </div>

          {/* Mentor & Mentee video */}
          <div className="flex gap-3 mb-4">
            {/* Mentor */}
            <div className="flex-1 rounded-xl bg-primary overflow-hidden relative h-24">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1">
                  <Icon name="graduation" size={18} className="text-white" />
                </div>
                <span className="text-[10px] text-white/90 font-medium">{copy.mentor}</span>
              </div>
              {/* Speaking indicator */}
              <div className="absolute bottom-2 left-2 flex items-center gap-0.5">
                {[10, 14, 8, 12].map((h, j) => (
                  <div
                    key={j}
                    className="w-0.5 bg-success rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${j * 0.15}s`,
                      animationDuration: "0.6s",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Mentee */}
            <div className="flex-1 rounded-xl bg-primary-700 overflow-hidden relative h-24">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1">
                  <Icon name="user" size={18} className="text-white" />
                </div>
                <span className="text-[10px] text-white/90 font-medium">{copy.mentee}</span>
              </div>
            </div>
          </div>

          {/* Chat/notes preview */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                <Icon name="graduation" size={10} className="text-white" />
              </div>
              <div className="bg-primary-50 rounded-lg rounded-tl-none px-3 py-1.5 text-[10px] text-primary-800">
                {copy.mentorMsg}
              </div>
            </div>
            <div className="flex items-start gap-2 justify-end">
              <div className="bg-brand-blue-soft rounded-lg rounded-tr-none px-3 py-1.5 text-[10px] text-primary-800">
                {copy.menteeMsg}
              </div>
              <div className="w-5 h-5 rounded-full bg-primary-400 flex-shrink-0 flex items-center justify-center">
                <Icon name="user" size={10} className="text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  // After a manual click on a step, suppress auto-advance until this
  // timestamp passes (3s after the most recent click).
  const cooldownUntilRef = useRef(0);
  const t = landingCopy.id.howItWorks;
  const v = landingCopy.id.visuals;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      if (Date.now() < cooldownUntilRef.current) return;
      setActiveStep((prev) => (prev + 1) % t.steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible, t.steps.length]);

  const handleStepClick = (i: number) => {
    setActiveStep(i);
    cooldownUntilRef.current = Date.now() + 3000;
  };

  return (
    <section ref={sectionRef} className="py-24 bg-white relative overflow-hidden">
      {/* Background photo (Glasgow) */}
      <Image
        src="/glasgow-bg.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={90}
        className="object-cover pointer-events-none select-none"
      />
      {/* Soft white wash so content stays legible over the photo */}
      <div className="absolute inset-0 bg-white/80 pointer-events-none" />

      {/* Organic gradient blobs */}
      <div
        className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(120px)", opacity: 0.6 }}
      />
      <div
        className="absolute -bottom-32 -right-20 w-[450px] h-[450px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(110px)", opacity: 0.5, animationDelay: "4s", animationDirection: "reverse" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#d5c6ef", filter: "blur(130px)", opacity: 0.3, animationDelay: "6s" }}
      />

      {/* Brand illustrations */}
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={100}
        height={100}
        className="absolute top-12 right-12 opacity-[0.07] pointer-events-none animate-float hidden lg:block"
      />
      <Image
        src="/illustrations/notebook.png"
        alt=""
        width={80}
        height={80}
        className="absolute bottom-16 left-12 opacity-[0.07] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "1.5s" }}
      />
      <Image
        src="/illustrations/open-book.png"
        alt=""
        width={70}
        height={70}
        className="absolute top-1/3 right-8 opacity-[0.05] pointer-events-none animate-float hidden xl:block"
        style={{ animationDelay: "2.5s" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-sm text-primary-700 font-medium mb-4">
            <Icon name="lightbulb" size={16} />
            {t.label}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            {t.heading}
          </h2>
          {t.subheading && (
            <p className="mt-4 text-text-muted text-lg max-w-2xl mx-auto">
              {t.subheading}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left: Steps — constrained + centered on md+ so the column's
              visual mass matches the right column's centered mentor card. */}
          <div className="space-y-12 md:space-y-8 md:max-w-sm md:mx-auto md:w-full">
            {t.steps.map((step, i) => (
              <div
                key={i}
                className={`transition-all duration-500 ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
                onClick={() => handleStepClick(i)}
              >
                {/* Step row (icon + content) */}
                <div className="flex gap-5 cursor-pointer">
                  {/* Step number & line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        activeStep === i
                          ? "bg-primary shadow-[var(--shadow-md)] scale-110"
                          : "bg-primary-100"
                      }`}
                    >
                      <Icon
                        name={STEP_ICONS[i]}
                        size={22}
                        className={activeStep === i ? "text-white" : "text-primary"}
                      />
                    </div>
                    {i < t.steps.length - 1 && (
                      <div className="w-0.5 h-12 mt-2 bg-primary-200 relative overflow-hidden hidden md:block">
                        <div
                          className={`absolute inset-x-0 top-0 bg-primary transition-all duration-1000 ${
                            activeStep > i ? "h-full" : "h-0"
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pt-1 flex-1 min-w-0 transition-all duration-300 ${activeStep === i ? "opacity-100" : "opacity-60"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-primary-400 tracking-widest">
                        {t.stepLabel} {i + 1}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mt-1 font-[family-name:var(--font-heading)]">
                      {step.title}
                    </h3>
                    <p className="text-text-muted mt-2 text-sm leading-relaxed md:max-w-sm">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Mobile-only inline visual paired with this step.
                    Always active on mobile; desktop uses the shared cycling visual on the right. */}
                <div className="md:hidden mt-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-soft/30 to-transparent rounded-3xl" />
                  <div className="relative py-8 flex items-center justify-center">
                    {i === 0 && <ProfileVisual active copy={v.profile} />}
                    {i === 1 && <MatchVisual active copy={v.match} />}
                    {i === 2 && <CalendarVisual active copy={v.calendar} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Shared cycling visual — desktop only (md+) */}
          <div className="hidden md:flex relative h-96 items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-soft/30 to-transparent rounded-3xl" />
            <div className="relative">
              {activeStep === 0 && <ProfileVisual active={activeStep === 0} copy={v.profile} />}
              {activeStep === 1 && <MatchVisual active={activeStep === 1} copy={v.match} />}
              {activeStep === 2 && <CalendarVisual active={activeStep === 2} copy={v.calendar} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
