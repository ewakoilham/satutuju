"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { useLang } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-copy";

type Copy = (typeof landingCopy)["id"] | (typeof landingCopy)["en"];

/* ── Visual 01: Roadmap Timeline (Planning) ── */
function RoadmapVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["roadmap"] }) {
  const statuses: Array<"done" | "current" | "upcoming"> = [
    "done",
    "done",
    "current",
    "upcoming",
    "upcoming",
  ];
  const icons = ["search", "document", "edit", "send", "users"];
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] p-6 w-80 mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">{copy.heading}</h4>
          <span className="text-[10px] bg-success-light text-success px-2 py-0.5 rounded-full font-medium">{copy.onTrack}</span>
        </div>
        <div className="space-y-0">
          {copy.labels.map((label, i) => {
            const status = statuses[i];
            return (
              <div key={i} className="flex gap-3" style={{ transitionDelay: `${i * 100}ms` }}>
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                    status === "done" ? "bg-primary" : status === "current" ? "bg-primary ring-4 ring-primary/20" : "bg-primary-100"
                  }`}>
                    <Icon name={icons[i]} size={14} className={status === "upcoming" ? "text-primary-300" : "text-white"} />
                  </div>
                  {i < copy.labels.length - 1 && (
                    <div className={`w-0.5 h-6 ${status === "done" ? "bg-primary" : "bg-primary-100"}`} />
                  )}
                </div>
                {/* Content */}
                <div className="pt-1 pb-3">
                  <span className="text-[10px] text-text-muted-2 font-mono">{copy.months[i]}</span>
                  <p className={`text-xs font-medium ${status === "upcoming" ? "text-text-muted" : "text-foreground"}`}>
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Visual 02: Essay Editor ── */
function EssayVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["essay"] }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden w-80 mx-auto">
        {/* Editor toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-primary-50/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <span className="text-[10px] text-text-muted ml-2 font-mono">motivation-letter.docx</span>
        </div>
        {/* Document content */}
        <div className="p-5 space-y-3 text-xs text-foreground/80 leading-relaxed">
          <p className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">{copy.title}</p>
          <p>{copy.p1}</p>
          {/* Highlighted section with mentor comment */}
          <div className="relative">
            <p className="bg-warning/10 border-l-2 border-warning px-3 py-2 rounded-r-lg">
              {copy.p2}
            </p>
            {/* Mentor comment bubble */}
            <div className="absolute -right-2 -top-3 bg-primary text-white text-[9px] px-2.5 py-1.5 rounded-lg rounded-br-none shadow-[var(--shadow-md)] max-w-[140px]">
              <span className="font-semibold">{copy.mentorLabel}</span> {copy.mentorComment}
            </div>
          </div>
          <p className="text-text-muted">{copy.p3}</p>
        </div>
        {/* Stats bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-primary-50/30 text-[9px] text-text-muted">
          <span>{copy.revision}</span>
          <span className="text-success font-medium">{copy.ready}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Visual 03: Document Checklist ── */
function ChecklistVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["checklist"] }) {
  const doneStates = [true, true, true, false, false];
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] p-6 w-72 mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">{copy.heading}</h4>
          <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">3/5</span>
        </div>
        <div className="space-y-3">
          {copy.items.map((label, i) => {
            const done = doneStates[i];
            return (
              <div
                key={i}
                className="flex items-center gap-3 transition-all duration-500"
                style={{ transitionDelay: `${i * 80}ms`, opacity: active ? 1 : 0.3, transform: active ? "translateX(0)" : "translateX(8px)" }}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${done ? "bg-primary" : "border-2 border-primary-200"}`}>
                  {done && <Icon name="check" size={12} className="text-white" />}
                </div>
                <span className={`text-xs ${done ? "text-foreground line-through opacity-60" : "text-foreground font-medium"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 h-1.5 bg-primary-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: active ? "60%" : "0%" }} />
        </div>
        <p className="text-[10px] text-text-muted mt-2 text-right">{copy.complete}</p>
      </div>
    </div>
  );
}

/* ── Visual 04: Interview Simulation ── */
function InterviewVisual({ active, copy }: { active: boolean; copy: Copy["visuals"]["interview"] }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden w-80 mx-auto">
        {/* Video call header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary-900">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-white font-medium">{copy.title}</span>
          </div>
          <span className="text-[10px] text-white/60 font-mono">32:15</span>
        </div>
        {/* Video panels */}
        <div className="flex gap-2 p-3">
          <div className="flex-1 rounded-xl bg-primary overflow-hidden relative h-24">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1">
                <Icon name="graduation" size={18} className="text-white" />
              </div>
              <span className="text-[9px] text-white/90 font-medium">{copy.mentorPanel}</span>
            </div>
            <div className="absolute bottom-2 left-2 flex items-center gap-0.5">
              {[8, 12, 7, 10].map((h, j) => (
                <div key={j} className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: `${h}px`, animationDelay: `${j * 0.15}s`, animationDuration: "0.6s" }} />
              ))}
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-primary-700 overflow-hidden relative h-24">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1">
                <Icon name="user" size={18} className="text-white" />
              </div>
              <span className="text-[9px] text-white/90 font-medium">{copy.you}</span>
            </div>
          </div>
        </div>
        {/* Current question */}
        <div className="mx-3 mb-3 p-3 bg-brand-blue-soft rounded-xl">
          <p className="text-[10px] text-primary-700 font-medium mb-1">{copy.currentQuestion}</p>
          <p className="text-xs text-primary-900 font-semibold">{copy.question}</p>
        </div>
        {/* Feedback badges */}
        <div className="flex items-center gap-2 px-3 pb-3">
          {copy.badges.map((b, i) => {
            const styles = [
              "bg-success-light text-success",
              "bg-warning-light text-warning",
              "bg-primary-100 text-primary-700",
            ];
            return (
              <span key={i} className={`text-[9px] ${styles[i]} px-2 py-0.5 rounded-full font-medium`}>
                {b}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function StickyValueProps() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { lang } = useLang();
  const t = landingCopy[lang].features;
  const v = landingCopy[lang].visuals;

  useEffect(() => {
    const sections = containerRef.current?.querySelectorAll("[data-vp-section]");
    if (!sections) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-vp-section"));
            setActiveIndex(index);
          }
        });
      },
      { threshold: 0.3, rootMargin: "-20% 0px -20% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-primary-900 relative" ref={containerRef}>
      {/* Decorative layer (overflow-hidden to contain blobs) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Organic gradient blobs (dark variants) */}
        <div
          className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full animate-blob-drift"
          style={{ background: "#233a7d", filter: "blur(120px)", opacity: 0.5 }}
        />
        <div
          className="absolute top-1/3 -right-32 w-[450px] h-[450px] rounded-full animate-blob-drift"
          style={{ background: "#2e4a9a", filter: "blur(110px)", opacity: 0.4, animationDelay: "5s", animationDirection: "reverse" }}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-[400px] h-[400px] rounded-full animate-blob-drift"
          style={{ background: "#1a2d60", filter: "blur(100px)", opacity: 0.5, animationDelay: "8s" }}
        />
        <div
          className="absolute top-[45%] left-1/4 w-[350px] h-[350px] rounded-full animate-blob-drift"
          style={{ background: "#2e4a9a", filter: "blur(120px)", opacity: 0.35, animationDelay: "3s" }}
        />

        {/* Brand illustrations — spread across all 4 value prop screens */}
        <Image
          src="/illustrations/puzzle-group.png"
          alt=""
          width={140}
          height={140}
          className="absolute top-[5%] right-[5%] opacity-[0.05] animate-float hidden lg:block"
        />
        <Image
          src="/illustrations/lightbulb.png"
          alt=""
          width={90}
          height={90}
          className="absolute top-[8%] left-[8%] opacity-[0.04] animate-float hidden lg:block"
          style={{ animationDelay: "1s" }}
        />
        <Image
          src="/illustrations/notebook.png"
          alt=""
          width={70}
          height={70}
          className="absolute top-[15%] right-[35%] opacity-[0.03] animate-float hidden xl:block"
          style={{ animationDelay: "2s" }}
        />
        <Image
          src="/illustrations/open-book.png"
          alt=""
          width={110}
          height={110}
          className="absolute top-[28%] left-[5%] opacity-[0.05] animate-float hidden lg:block"
          style={{ animationDelay: "1.5s" }}
        />
        <Image
          src="/illustrations/globe.png"
          alt=""
          width={80}
          height={80}
          className="absolute top-[35%] right-[8%] opacity-[0.04] animate-float hidden lg:block"
          style={{ animationDelay: "2.5s" }}
        />
        <Image
          src="/illustrations/open-book.png"
          alt=""
          width={90}
          height={90}
          className="absolute top-[44%] right-[15%] opacity-[0.05] animate-float hidden lg:block"
          style={{ animationDelay: "0.8s" }}
        />
        <Image
          src="/illustrations/puzzle-piece.png"
          alt=""
          width={80}
          height={80}
          className="absolute top-[46%] left-[15%] opacity-[0.04] animate-float hidden lg:block"
          style={{ animationDelay: "2.8s" }}
        />
        <Image
          src="/illustrations/puzzle-piece.png"
          alt=""
          width={100}
          height={100}
          className="absolute top-[55%] right-[6%] opacity-[0.05] animate-float hidden lg:block"
          style={{ animationDelay: "0.5s" }}
        />
        <Image
          src="/illustrations/lightbulb.png"
          alt=""
          width={70}
          height={70}
          className="absolute top-[60%] left-[10%] opacity-[0.04] animate-float hidden lg:block"
          style={{ animationDelay: "3s" }}
        />
        <Image
          src="/illustrations/notebook.png"
          alt=""
          width={80}
          height={80}
          className="absolute top-[52%] left-[30%] opacity-[0.03] animate-float hidden xl:block"
          style={{ animationDelay: "4s" }}
        />
        <Image
          src="/illustrations/globe.png"
          alt=""
          width={100}
          height={100}
          className="absolute top-[80%] left-[6%] opacity-[0.05] animate-float hidden lg:block"
          style={{ animationDelay: "1.8s" }}
        />
        <Image
          src="/illustrations/open-book.png"
          alt=""
          width={80}
          height={80}
          className="absolute top-[85%] right-[10%] opacity-[0.04] animate-float hidden lg:block"
          style={{ animationDelay: "3.5s" }}
        />
        <Image
          src="/illustrations/puzzle-group.png"
          alt=""
          width={70}
          height={70}
          className="absolute top-[90%] left-[25%] opacity-[0.03] animate-float hidden xl:block"
          style={{ animationDelay: "2.2s" }}
        />
      </div>

      {/* Section header (label + intro) — rendered only when copy is present */}
      {(t.label || t.intro1 || t.intro2) && (
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-20 lg:pt-24 relative z-10">
          {t.label && (
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-sm text-primary-200 font-medium">
              <Icon name="lightbulb" size={16} />
              {t.label}
            </span>
          )}
          {t.intro1 && (
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight font-[family-name:var(--font-heading)] max-w-2xl">
              {t.intro1}
            </h2>
          )}
          {t.intro2 && (
            <p className="mt-4 text-primary-200/80 text-base lg:text-lg leading-relaxed max-w-2xl">
              {t.intro2}
            </p>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="lg:grid lg:grid-cols-2">
          {/* Left: Scrollable text sections */}
          <div>
            {t.slides.map((vp, i) => (
              <div
                key={i}
                data-vp-section={i}
                className="min-h-[70vh] flex items-center py-16 px-6 lg:px-12"
              >
                <div className="max-w-lg">
                  <span className="text-primary-300 text-sm font-mono tracking-widest">
                    {vp.number} / 04
                  </span>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mt-3 lg:mt-4 leading-tight font-[family-name:var(--font-heading)]">
                    {vp.title}
                  </h3>
                  <p className="mt-4 lg:mt-6 text-primary-200/80 text-base lg:text-lg leading-relaxed">
                    {vp.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Sticky visual display */}
          <div className="hidden lg:block relative">
            <div className="sticky top-0 h-screen flex items-center justify-center px-8 lg:px-12">
              {/* Visual 01 — Planning / Roadmap */}
              <div
                className="absolute inset-0 flex items-center justify-center px-8 lg:px-12 transition-all duration-700"
                style={{
                  opacity: activeIndex === 0 ? 1 : 0,
                  visibility: activeIndex === 0 ? "visible" : "hidden",
                  transform: activeIndex === 0 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
                  pointerEvents: activeIndex === 0 ? "auto" : "none",
                }}
              >
                <RoadmapVisual active={activeIndex === 0} copy={v.roadmap} />
              </div>
              {/* Visual 02 — Essay */}
              <div
                className="absolute inset-0 flex items-center justify-center px-8 lg:px-12 transition-all duration-700"
                style={{
                  opacity: activeIndex === 1 ? 1 : 0,
                  visibility: activeIndex === 1 ? "visible" : "hidden",
                  transform: activeIndex === 1 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
                  pointerEvents: activeIndex === 1 ? "auto" : "none",
                }}
              >
                <EssayVisual active={activeIndex === 1} copy={v.essay} />
              </div>
              {/* Visual 03 — Documents Checklist */}
              <div
                className="absolute inset-0 flex items-center justify-center px-8 lg:px-12 transition-all duration-700"
                style={{
                  opacity: activeIndex === 2 ? 1 : 0,
                  visibility: activeIndex === 2 ? "visible" : "hidden",
                  transform: activeIndex === 2 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
                  pointerEvents: activeIndex === 2 ? "auto" : "none",
                }}
              >
                <ChecklistVisual active={activeIndex === 2} copy={v.checklist} />
              </div>
              {/* Visual 04 — Interview */}
              <div
                className="absolute inset-0 flex items-center justify-center px-8 lg:px-12 transition-all duration-700"
                style={{
                  opacity: activeIndex === 3 ? 1 : 0,
                  visibility: activeIndex === 3 ? "visible" : "hidden",
                  transform: activeIndex === 3 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
                  pointerEvents: activeIndex === 3 ? "auto" : "none",
                }}
              >
                <InterviewVisual active={activeIndex === 3} copy={v.interview} />
              </div>

              {/* Progress dots */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {t.slides.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 rounded-full transition-all duration-500 ${
                      i === activeIndex
                        ? "h-8 bg-white"
                        : i < activeIndex
                        ? "h-2 bg-white/60"
                        : "h-2 bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Down arrow at bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <Icon name="chevron-down" size={28} className="text-white/40 animate-float" />
      </div>
    </section>
  );
}
