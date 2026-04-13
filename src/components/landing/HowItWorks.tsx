"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";

const STEPS = [
  {
    number: 1,
    icon: "user" as const,
    title: "Buat Profil",
    description: "Daftar dan ceritakan tujuan beasiswamu. Kami perlu tahu impianmu untuk mencocokkan mentor terbaik.",
    visual: "profile",
  },
  {
    number: 2,
    icon: "puzzle" as const,
    title: "Dapat Mentor",
    description: "Kami cocokkan kamu dengan mentor yang paling sesuai berdasarkan beasiswa, universitas, dan bidang studi.",
    visual: "match",
  },
  {
    number: 3,
    icon: "calendar" as const,
    title: "Mulai Sesi",
    description: "Booking jadwal mentoring dan mulai perjalanan persiapan beasiswamu bersama mentor berpengalaman.",
    visual: "calendar",
  },
];

function ProfileVisual({ active }: { active: boolean }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] p-6 w-72 mx-auto">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
          <span className="text-xl font-bold text-white font-[family-name:var(--font-heading)]">MR</span>
        </div>
        {/* Name */}
        <h4 className="text-center font-bold text-foreground font-[family-name:var(--font-heading)] text-base">
          Muhammad Razak
        </h4>
        {/* Details */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-start gap-2.5 bg-primary-50 rounded-lg px-3 py-2.5">
            <Icon name="graduation" size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-text-muted-2 uppercase tracking-wider font-medium">Target Universitas</p>
              <p className="text-xs text-foreground font-medium">Monash University — Master of Business</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-brand-blue-soft rounded-lg px-3 py-2.5">
            <Icon name="document" size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-text-muted-2 uppercase tracking-wider font-medium">Beasiswa</p>
              <p className="text-xs text-foreground font-medium">LPDP 2026</p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-10 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-medium">Daftar Sekarang</span>
        </div>
      </div>
    </div>
  );
}

function MatchVisual({ active }: { active: boolean }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="flex items-center justify-center gap-4">
        {/* Mentee */}
        <div className="w-20 h-20 rounded-2xl bg-white shadow-[var(--shadow-md)] flex items-center justify-center">
          <Icon name="user" size={28} className="text-primary-400" />
        </div>
        {/* Connection animation */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="w-3 h-3 rounded-full bg-primary animate-pulse-glow"
              style={{ animationDelay: `${j * 0.3}s` }}
            />
          ))}
        </div>
        {/* Puzzle piece */}
        <div className="w-16 h-16 flex items-center justify-center">
          <Icon name="puzzle" size={40} className="text-primary animate-float" />
        </div>
        {/* Connection animation */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="w-3 h-3 rounded-full bg-primary animate-pulse-glow"
              style={{ animationDelay: `${j * 0.3 + 0.5}s` }}
            />
          ))}
        </div>
        {/* Mentor */}
        <div className="w-20 h-20 rounded-2xl bg-white shadow-[var(--shadow-md)] flex items-center justify-center">
          <Icon name="graduation" size={28} className="text-primary" />
        </div>
      </div>
      <p className="text-center text-sm text-primary-700 mt-4 font-medium">
        Mencocokkan mentor terbaik...
      </p>
    </div>
  );
}

function CalendarVisual({ active }: { active: boolean }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="relative flex items-start gap-4">
        {/* Calendar card - shown alongside session */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] p-4 w-48 flex-shrink-0 mt-8">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-foreground text-xs font-[family-name:var(--font-heading)]">April 2026</span>
            <Icon name="calendar" size={14} className="text-primary" />
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
            {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => (
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
              <span className="text-xs font-semibold text-success">Sesi Berlangsung</span>
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
                <span className="text-[10px] text-white/90 font-medium">Mentor</span>
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
                <span className="text-[10px] text-white/90 font-medium">Mentee</span>
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
                Ayo kita review esai motivasimu...
              </div>
            </div>
            <div className="flex items-start gap-2 justify-end">
              <div className="bg-brand-blue-soft rounded-lg rounded-tr-none px-3 py-1.5 text-[10px] text-primary-800">
                Siap, kak! Sudah saya revisi
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
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section ref={sectionRef} className="py-24 bg-white relative overflow-hidden">
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
            Cara Kerja
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Bagaimana Cara Kerjanya?
          </h2>
          <p className="mt-4 text-text-muted text-lg max-w-2xl mx-auto">
            Tiga langkah sederhana untuk memulai perjalanan beasiswamu
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Steps */}
          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex gap-5 cursor-pointer transition-all duration-500 ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
                onClick={() => setActiveStep(i)}
              >
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
                      name={step.icon}
                      size={22}
                      className={activeStep === i ? "text-white" : "text-primary"}
                    />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-0.5 h-12 mt-2 bg-primary-200 relative overflow-hidden">
                      <div
                        className={`absolute inset-x-0 top-0 bg-primary transition-all duration-1000 ${
                          activeStep > i ? "h-full" : "h-0"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={`pt-1 transition-all duration-300 ${activeStep === i ? "opacity-100" : "opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-primary-400 tracking-widest">
                      LANGKAH {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mt-1 font-[family-name:var(--font-heading)]">
                    {step.title}
                  </h3>
                  <p className="text-text-muted mt-2 text-sm leading-relaxed max-w-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Animated Visual */}
          <div className="relative h-96 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-soft/30 to-transparent rounded-3xl" />
            <div className="relative">
              {activeStep === 0 && <ProfileVisual active={activeStep === 0} />}
              {activeStep === 1 && <MatchVisual active={activeStep === 1} />}
              {activeStep === 2 && <CalendarVisual active={activeStep === 2} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
