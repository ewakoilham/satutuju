"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";

const VALUE_PROPS = [
  {
    number: "01",
    title: "Semua persiapan beasiswa yang kamu butuhkan Ada disini",
    description:
      "Kami membimbing kamu di setiap tahap — dari persiapan dokumen, esai motivasi, simulasi wawancara, hingga kamu benar-benar lolos. Dipandu langsung oleh alumni yang sudah melalui proses yang sama.",
  },
  {
    number: "02",
    title: "Mulai dengan Peta Jalan yang Jelas",
    description:
      "Mentor kami bantu kamu memetakan target beasiswa yang paling sesuai profilmu, menyusun timeline aplikasi, dan membangun narasi diri yang kuat sejak awal.",
  },
  {
    number: "03",
    title: "Esai yang Benar-Benar Mencerminkan Kamu.",
    description:
      "Bukan template, bukan copy-paste. Mentor kami bantu kamu menemukan cerita yang autentik — yang membuat reviewer beasiswa berhenti membaca dan mulai mempertimbangkan.",
  },
  {
    number: "04",
    title: "Latihan Wawancara Sampai Kamu Siap.",
    description:
      "Wawancara Beasiswa bukan soal hafalan jawaban — tapi soal cara kamu berpikir. Mentor kami simulasikan pertanyaan nyata dan bantu kamu tampil percaya diri di hadapan panel.",
  },
];

/* ── Visual 01: Document Checklist ── */
function ChecklistVisual({ active }: { active: boolean }) {
  const items = [
    { label: "Curriculum Vitae (CV)", done: true },
    { label: "Motivation Letter", done: true },
    { label: "Transkrip Akademik", done: true },
    { label: "Surat Rekomendasi", done: false },
    { label: "Research Proposal", done: false },
  ];
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] p-6 w-72 mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">Checklist Dokumen</h4>
          <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">3/5</span>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 transition-all duration-500"
              style={{ transitionDelay: `${i * 80}ms`, opacity: active ? 1 : 0.3, transform: active ? "translateX(0)" : "translateX(8px)" }}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${item.done ? "bg-primary" : "border-2 border-primary-200"}`}>
                {item.done && <Icon name="check" size={12} className="text-white" />}
              </div>
              <span className={`text-xs ${item.done ? "text-foreground line-through opacity-60" : "text-foreground font-medium"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 h-1.5 bg-primary-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: active ? "60%" : "0%" }} />
        </div>
        <p className="text-[10px] text-text-muted mt-2 text-right">60% selesai</p>
      </div>
    </div>
  );
}

/* ── Visual 02: Roadmap Timeline ── */
function RoadmapVisual({ active }: { active: boolean }) {
  const milestones = [
    { month: "Jan", label: "Riset Beasiswa", icon: "search", status: "done" },
    { month: "Feb", label: "Siapkan Dokumen", icon: "document", status: "done" },
    { month: "Mar", label: "Tulis Esai", icon: "edit", status: "current" },
    { month: "Apr", label: "Submit Aplikasi", icon: "send", status: "upcoming" },
    { month: "Mei", label: "Wawancara", icon: "users", status: "upcoming" },
  ];
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] p-6 w-80 mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">Peta Jalan Beasiswa</h4>
          <span className="text-[10px] bg-success-light text-success px-2 py-0.5 rounded-full font-medium">On Track</span>
        </div>
        <div className="space-y-0">
          {milestones.map((m, i) => (
            <div key={i} className="flex gap-3" style={{ transitionDelay: `${i * 100}ms` }}>
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                  m.status === "done" ? "bg-primary" : m.status === "current" ? "bg-primary ring-4 ring-primary/20" : "bg-primary-100"
                }`}>
                  <Icon name={m.icon} size={14} className={m.status === "upcoming" ? "text-primary-300" : "text-white"} />
                </div>
                {i < milestones.length - 1 && (
                  <div className={`w-0.5 h-6 ${m.status === "done" ? "bg-primary" : "bg-primary-100"}`} />
                )}
              </div>
              {/* Content */}
              <div className="pt-1 pb-3">
                <span className="text-[10px] text-text-muted-2 font-mono">{m.month}</span>
                <p className={`text-xs font-medium ${m.status === "upcoming" ? "text-text-muted" : "text-foreground"}`}>
                  {m.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Visual 03: Essay Editor ── */
function EssayVisual({ active }: { active: boolean }) {
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
          <p className="font-bold text-foreground text-sm font-[family-name:var(--font-heading)]">Motivation Letter</p>
          <p>Sejak kecil, saya memiliki ketertarikan yang mendalam terhadap...</p>
          {/* Highlighted section with mentor comment */}
          <div className="relative">
            <p className="bg-warning/10 border-l-2 border-warning px-3 py-2 rounded-r-lg">
              Pengalaman memimpin organisasi mahasiswa mengajarkan saya tentang...
            </p>
            {/* Mentor comment bubble */}
            <div className="absolute -right-2 -top-3 bg-primary text-white text-[9px] px-2.5 py-1.5 rounded-lg rounded-br-none shadow-[var(--shadow-md)] max-w-[140px]">
              <span className="font-semibold">Mentor:</span> Bagus! Tambahkan impact yang lebih spesifik
            </div>
          </div>
          <p className="text-text-muted">Melalui beasiswa ini, saya berharap dapat...</p>
        </div>
        {/* Stats bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-primary-50/30 text-[9px] text-text-muted">
          <span>Revisi ke-3</span>
          <span className="text-success font-medium">85% siap submit</span>
        </div>
      </div>
    </div>
  );
}

/* ── Visual 04: Interview Simulation ── */
function InterviewVisual({ active }: { active: boolean }) {
  return (
    <div className={`transition-all duration-700 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="bg-white rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden w-80 mx-auto">
        {/* Video call header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary-900">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-white font-medium">Simulasi Wawancara</span>
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
              <span className="text-[9px] text-white/90 font-medium">Mentor Panel</span>
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
              <span className="text-[9px] text-white/90 font-medium">Kamu</span>
            </div>
          </div>
        </div>
        {/* Current question */}
        <div className="mx-3 mb-3 p-3 bg-brand-blue-soft rounded-xl">
          <p className="text-[10px] text-primary-700 font-medium mb-1">Pertanyaan saat ini:</p>
          <p className="text-xs text-primary-900 font-semibold">&ldquo;Apa kontribusi yang ingin kamu berikan setelah lulus?&rdquo;</p>
        </div>
        {/* Feedback badges */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <span className="text-[9px] bg-success-light text-success px-2 py-0.5 rounded-full font-medium">Percaya diri</span>
          <span className="text-[9px] bg-warning-light text-warning px-2 py-0.5 rounded-full font-medium">Perjelas impact</span>
          <span className="text-[9px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Kontak mata</span>
        </div>
      </div>
    </div>
  );
}

const VISUALS = [ChecklistVisual, RoadmapVisual, EssayVisual, InterviewVisual];

export default function StickyValueProps() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
        {/* VP 1 area (top) */}
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

        {/* VP 2 area (25-50%) */}
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

        {/* VP 2-3 transition area (45-55%) */}
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

        {/* VP 3 area (50-75%) */}
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

        {/* VP 4 area (75-100%) */}
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

      <div className="max-w-7xl mx-auto">
        <div className="lg:grid lg:grid-cols-2">
          {/* Left: Scrollable text sections */}
          <div>
            {VALUE_PROPS.map((vp, i) => (
              <div
                key={i}
                data-vp-section={i}
                className="min-h-[70vh] flex items-center py-16 px-6 lg:px-12"
              >
                <div className="max-w-lg">
                  <span className="text-primary-300 text-sm font-mono tracking-widest">
                    {vp.number} / 04
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mt-3 lg:mt-4 leading-tight font-[family-name:var(--font-heading)]">
                    {vp.title}
                  </h2>
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
              {VALUE_PROPS.map((_, i) => {
                const Visual = VISUALS[i];
                return (
                  <div
                    key={i}
                    className="absolute inset-0 flex items-center justify-center px-8 lg:px-12 transition-all duration-700"
                    style={{
                      opacity: activeIndex === i ? 1 : 0,
                      visibility: activeIndex === i ? "visible" : "hidden",
                      transform: activeIndex === i ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
                      pointerEvents: activeIndex === i ? "auto" : "none",
                    }}
                  >
                    <Visual active={activeIndex === i} />
                  </div>
                );
              })}

              {/* Progress dots */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {VALUE_PROPS.map((_, i) => (
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
