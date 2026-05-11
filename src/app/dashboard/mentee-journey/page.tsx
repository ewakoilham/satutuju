"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useUser } from "@/lib/hooks";

/**
 * Mentee Registration Journey — horizontal swim lane diagram, internal
 * reference for admins and mentors. Mirrors `customer-journey-satutuju.md`:
 * 5 stages × 3 actors, 14 core steps + 4 add-ons, with the Stage-04 branch
 * (Jalur A / Jalur B) and the approach-mentor loop annotated inline.
 */

// ─── Data model ──────────────────────────────────────────────────────────

type ActorId = "mentee" | "satutuju" | "mentor";
type StageId = 1 | 2 | 3 | 4 | 5;

type CardKind =
  | { type: "step"; num: number }
  | { type: "addon" }
  | { type: "branch"; track: "A" | "B" }
  | { type: "loop" };

type LaneAdjacency = "above" | "below"; // hint that this card connects vertically to the neighbouring lane

type Card = {
  id: string;
  kind: CardKind;
  stage: StageId;
  lane: ActorId;
  title: string;
  summary?: string;
  /** Joint event — visually mark "with another lane" alongside the card. */
  jointWith?: ActorId;
  /** When the joint partner sits in another lane, choose which way the
   *  little connector arrow should hint. */
  connect?: LaneAdjacency;
};

const STAGES: { id: StageId; num: string; name: string; subtitle: string }[] = [
  { id: 1, num: "01", name: "Tertarik",      subtitle: "Mentee mulai kenal kami" },
  { id: 2, num: "02", name: "Daftar",        subtitle: "Pintu pertama dibuka" },
  { id: 3, num: "03", name: "Saring",        subtitle: "Kualitas terjaga" },
  { id: 4, num: "04", name: "Pasangkan",     subtitle: "Cari kepingan yang pas" },
  { id: 5, num: "05", name: "Mulai Bersama", subtitle: "Perjalanan resmi dimulai" },
];

const LANES: { id: ActorId; label: string; accent: string }[] = [
  { id: "mentee",   label: "Mentee",    accent: "border-l-primary" },
  { id: "satutuju", label: "Satu Tuju", accent: "border-l-warning" },
  { id: "mentor",   label: "Mentor",    accent: "border-l-success" },
];

const CARDS: Card[] = [
  // ── Stage 01 — Tertarik ────────────────────────────────────────────────
  { id: "s1",  kind: { type: "step", num: 1 }, stage: 1, lane: "mentee",
    title: "Lihat marketing top-funnel",
    summary: "Konten organic, Instagram @satutuju.ed, atau Meta ads." },
  { id: "s2",  kind: { type: "step", num: 2 }, stage: 1, lane: "mentee",
    title: "Tertarik",
    summary: "Ingin tahu lebih jauh — siapa kami, untuk siapa, caranya." },

  // ── Stage 02 — Daftar ──────────────────────────────────────────────────
  { id: "s3",  kind: { type: "step", num: 3 }, stage: 2, lane: "mentee",
    title: 'Klik "Gabung Sekarang"',
    summary: "Buka satutuju.id, tekan CTA utama." },
  { id: "s4",  kind: { type: "step", num: 4 }, stage: 2, lane: "mentee",
    title: "Isi initial form",
    summary: "Data dasar, tujuan studi, konteks awal." },
  { id: "s5",  kind: { type: "step", num: 5 }, stage: 2, lane: "satutuju",
    title: "Terima & review form",
    summary: "Lead masuk ke pipeline; tim cek prospect awal." },
  { id: "a2",  kind: { type: "addon" },        stage: 2, lane: "satutuju",
    title: "Auto-konfirmasi",
    summary: "Notifikasi otomatis ke mentee dalam hitungan menit — janji follow-up dalam 2×24 jam." },

  // ── Stage 03 — Saring ──────────────────────────────────────────────────
  { id: "s6",  kind: { type: "step", num: 6 }, stage: 3, lane: "satutuju",
    title: "Initial call",
    summary: "6 hal kunci: kampus partner, deposit, timeline <12 bln, IELTS/CV/essay, preferensi mentor, tujuan studi.",
    jointWith: "mentee", connect: "above" },
  { id: "s7",  kind: { type: "step", num: 7 }, stage: 3, lane: "satutuju",
    title: "Assessment kelayakan",
    summary: "Tim putuskan lanjut / tidak. Yang belum cocok diberikan saran alternatif." },
  { id: "a3",  kind: { type: "addon" },        stage: 3, lane: "mentee",
    title: "Refundable deposit",
    summary: "Gate komitmen — mentor diapproach hanya untuk mentee yang sudah menunjukkan komitmen finansial." },

  // ── Stage 04 — Pasangkan ───────────────────────────────────────────────
  { id: "s8",  kind: { type: "step", num: 8 }, stage: 4, lane: "satutuju",
    title: "Matching dimulai",
    summary: "Mulai setelah deposit masuk dan profil ter-assess." },
  { id: "s9",  kind: { type: "branch", track: "A" }, stage: 4, lane: "satutuju",
    title: "Jalur A — Mentee punya preferensi",
    summary: "Mentee sebut 1–3 mentor pilihan. Tim approach urut dari pilihan #1 → #2 → #3." },
  { id: "s11", kind: { type: "branch", track: "B" }, stage: 4, lane: "satutuju",
    title: "Jalur B — Mentee tidak menentukan",
    summary: "Tim Satu Tuju yang tentukan prioritas: kampus tujuan, bidang studi, kapasitas mentor." },
  { id: "s10", kind: { type: "loop" },         stage: 4, lane: "satutuju",
    title: "Approach mentor (loop)",
    summary: "Iterasi: jika mentor tolak, lanjut ke mentor berikutnya sampai ada yang cocok dan menerima.",
    jointWith: "mentor", connect: "below" },
  { id: "s12", kind: { type: "step", num: 12 }, stage: 4, lane: "mentor",
    title: "Mentor putuskan: terima / tolak",
    summary: "Transparansi penuh: profil mentee, alasan diapproach, track + insentif. Hak tolak tanpa beban." },

  // ── Stage 05 — Mulai Bersama ───────────────────────────────────────────
  { id: "a5a", kind: { type: "addon" }, stage: 5, lane: "satutuju",
    title: "Schedule intro call",
    summary: "Tim atur jadwal pertemuan pertama antara mentee dan mentor." },
  { id: "a5b", kind: { type: "addon" }, stage: 5, lane: "mentor",
    title: "Intro call (mentee × mentor)",
    summary: "30 menit. Kenalan, lihat chemistry sebelum komit.",
    jointWith: "mentee", connect: "above" },
  { id: "s13", kind: { type: "step", num: 13 }, stage: 5, lane: "mentee",
    title: "Konfirmasi kesediaan",
    summary: "Setelah ketemu mentor, mentee final say — bersedia lanjut atau tidak." },
  { id: "s14", kind: { type: "step", num: 14 }, stage: 5, lane: "satutuju",
    title: "Hand over",
    summary: "Mentor pegang penuh. Satu Tuju step back ke supporting role.",
    jointWith: "mentor", connect: "below" },
  { id: "a5c", kind: { type: "addon" }, stage: 5, lane: "mentor",
    title: "Kickoff session",
    summary: "Sesi pertama resmi. Tanpa kickoff, 'diterima mentor' tetap abstrak.",
    jointWith: "mentee", connect: "above" },
];

// ─── Visual subcomponents ────────────────────────────────────────────────

function StageHeader({ num, name, subtitle }: { num: string; name: string; subtitle: string }) {
  return (
    <div className="px-2.5 py-2 rounded-lg bg-primary-50 border border-primary-100">
      <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-primary-600">
        Tahap {num}
      </p>
      <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-primary-900 leading-tight">
        {name}
      </p>
      <p className="text-[10px] text-text-muted mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}

function LaneLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div className={`flex items-center pl-2 border-l-4 ${accent}`}>
      <p className="font-semibold text-foreground text-xs">{label}</p>
    </div>
  );
}

function StepCard({ card, defaultOpen }: { card: Card; defaultOpen: boolean }) {
  const k = card.kind;
  const [open, setOpen] = useState(defaultOpen);

  const baseChrome = (() => {
    switch (k.type) {
      case "addon":
        return "border-dashed border-primary-200 bg-primary-50/40 hover:bg-primary-50";
      case "loop":
        return "border-warning/60 bg-warning-light/40 hover:bg-warning-light/70";
      case "branch":
        return "border-info/40 bg-info-light/40 hover:bg-info-light/70";
      default:
        return "border-border bg-surface hover:bg-surface-elevated";
    }
  })();

  const badge = (() => {
    switch (k.type) {
      case "step":
        return (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0">
            {k.num}
          </span>
        );
      case "addon":
        return (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-100 text-primary text-[10px] font-bold px-1 flex-shrink-0">
            +
          </span>
        );
      case "branch":
        return (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-info text-white text-[9px] font-bold px-1 flex-shrink-0">
            {k.track}
          </span>
        );
      case "loop":
        return (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-warning text-white text-[9px] font-bold px-1 flex-shrink-0">
            ↻
          </span>
        );
    }
  })();

  return (
    <div className={`rounded-md border transition ${baseChrome}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-2 py-1.5 flex items-start gap-1.5"
      >
        {badge}
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] font-semibold text-foreground leading-tight">
            {card.title}
          </p>
          {card.jointWith && (
            <p className="mt-0.5 text-[9.5px] font-semibold text-primary-700 leading-snug flex items-center gap-0.5">
              <Icon name="link" size={9} />
              {LANES.find((l) => l.id === card.jointWith)?.label}
              {card.connect === "above" && " ↑"}
              {card.connect === "below" && " ↓"}
            </p>
          )}
        </div>
        {card.summary && (
          <Icon
            name="chevron-down"
            size={12}
            className={`flex-shrink-0 mt-0.5 text-text-muted-2 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {open && card.summary && (
        <div className="px-2 pb-2 pt-0 -mt-0.5 text-[10.5px] text-text-muted leading-relaxed border-t border-border/60">
          <p className="mt-1.5">{card.summary}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function MenteeJourneyPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  // Bumping `bulkVersion` remounts every StepCard with the new
  // defaultOpen, so the "Buka semua / Tutup semua" toggle resets all
  // per-card state in one shot.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkVersion, setBulkVersion] = useState(0);

  useEffect(() => {
    if (!loading && user && user.role !== "admin" && user.role !== "mentor") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;
  if (user.role !== "admin" && user.role !== "mentor") return null;

  function toggleAll() {
    setBulkOpen((prev) => !prev);
    setBulkVersion((v) => v + 1);
  }

  // Group cards by (lane, stage) so we can drop them into the right grid cell.
  const byCell = new Map<string, Card[]>();
  for (const c of CARDS) {
    const key = `${c.lane}-${c.stage}`;
    const arr = byCell.get(key) ?? [];
    arr.push(c);
    byCell.set(key, arr);
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/dashboard/resources"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-foreground"
        >
          ← Kembali ke Resources
        </Link>
        <h1 className="mt-3 text-2xl md:text-3xl font-bold font-[family-name:var(--font-heading)] text-foreground">
          Mentee Registration Journey
        </h1>
        <p className="mt-2 text-sm text-text-muted max-w-3xl">
          Peta proses pendaftaran mentee dari pertama kenal Satu Tuju sampai
          handover resmi ke mentor. <strong>5 tahap</strong>,{" "}
          <strong>14 langkah inti</strong>, plus <strong>4 langkah tambahan</strong>{" "}
          untuk menutup celah waktu di antaranya.
        </p>
      </header>

      {/* Legend */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-4 md:p-5">
        <p className="text-xs uppercase tracking-[0.16em] font-semibold text-text-muted-2 mb-3">
          Legenda
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <LegendItem
            badge={<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">1</span>}
            label="Langkah inti"
            desc="1–14, bagian wajib dari journey."
          />
          <LegendItem
            badge={<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-100 text-primary text-[10px] font-bold px-1.5">+</span>}
            label="Tambahan"
            desc="Penghalus pengalaman antara langkah inti."
          />
          <LegendItem
            badge={<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-info text-white text-[10px] font-bold px-1.5">A</span>}
            label="Percabangan"
            desc="Jalur A/B di tahap pasangkan."
          />
          <LegendItem
            badge={<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold px-1.5">↻</span>}
            label="Loop"
            desc="Approach mentor satu per satu sampai cocok."
          />
        </div>
      </section>

      {/* Swim lane diagram. Each card is collapsible — click the card body
          (or the chevron) to expand its description. "Buka semua / Tutup
          semua" remounts all cards with the new default. */}
      <section>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Icon name="chevron-down" size={12} className={bulkOpen ? "rotate-180 transition" : "transition"} />
            {bulkOpen ? "Tutup semua detail" : "Buka semua detail"}
          </button>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <div className="min-w-[960px] space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[100px_repeat(5,minmax(0,1fr))] gap-2">
              <div />
              {STAGES.map((s) => (
                <StageHeader key={s.id} num={s.num} name={s.name} subtitle={s.subtitle} />
              ))}
            </div>

            {/* Lane rows */}
            {LANES.map((lane, laneIdx) => {
              return (
                <div
                  key={lane.id}
                  className="relative grid grid-cols-[100px_repeat(5,minmax(0,1fr))] gap-2"
                >
                  <LaneLabel label={lane.label} accent={lane.accent} />

                  {STAGES.map((stage) => {
                    const cards = byCell.get(`${lane.id}-${stage.id}`) ?? [];
                    return (
                      <div
                        key={`${lane.id}-${stage.id}`}
                        className="relative flex flex-col gap-1.5 rounded-lg bg-background/40 p-1.5 min-h-[80px]"
                      >
                        {/* Cross-lane joint stubs */}
                        {cards.some((c) => c.connect === "above") && laneIdx > 0 && (
                          <div
                            aria-hidden
                            className="absolute left-1/2 -top-2 h-2 w-0 border-l-2 border-dashed border-primary-300 pointer-events-none"
                          />
                        )}
                        {cards.some((c) => c.connect === "below") &&
                          laneIdx < LANES.length - 1 && (
                            <div
                              aria-hidden
                              className="absolute left-1/2 -bottom-2 h-2 w-0 border-l-2 border-dashed border-primary-300 pointer-events-none"
                            />
                          )}

                        {cards.map((c, i) => (
                          <Fragment key={c.id}>
                            {i > 0 && (
                              <div
                                className="flex justify-center text-text-muted-2 -my-0.5"
                                aria-hidden
                              >
                                <Icon name="chevron-down" size={12} />
                              </div>
                            )}
                            <StepCard
                              key={`${c.id}-${bulkVersion}`}
                              card={c}
                              defaultOpen={bulkOpen}
                            />
                          </Fragment>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-muted-2">
          Klik kartu untuk membuka detailnya. Garis vertikal putus-putus =
          joint event antar lane.
        </p>
      </section>

      {/* Four commitments to mentors */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Empat Komitmen Satu Tuju kepada Mentor
        </h2>
        <p className="text-sm text-text-muted italic mb-4">
          Satu Tuju tidak akan memberikan low-quality leads, dan tidak akan
          pernah memaksa mentor menerima mentee bila tidak cocok.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Commitment num="01" title="Check leads quality">
            Enam hal kunci dicek di initial call. Yang tidak cocok akan
            diberikan saran alternatif.
          </Commitment>
          <Commitment num="02" title="Komitmen mentee">
            Mentee membayar refundable deposit sebelum proses matching
            dimulai. Sehingga begitu mentor diapproach, mentee sudah
            menunjukkan komitmen.
          </Commitment>
          <Commitment num="03" title="Transparansi">
            Mentor berhak melihat profil lengkap mentee sebelum memutuskan:
            tujuan, kampus, IELTS, CV, essay, timeline. Plus alasan kenapa
            mentor tersebut yang diapproach.
          </Commitment>
          <Commitment num="04" title="Hak menolak">
            Mentor berhak untuk menolak, terutama kalau kapasitas mentoring
            penuh atau merasa belum cocok. Tim Satu Tuju akan approach
            mentor lain.
          </Commitment>
        </div>
      </section>
    </div>
  );
}

function LegendItem({
  badge,
  label,
  desc,
}: {
  badge: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{badge}</div>
      <div>
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-text-muted leading-snug">{desc}</p>
      </div>
    </div>
  );
}

function Commitment({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary font-bold text-sm flex-shrink-0">
        {num}
      </span>
      <div>
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed mt-0.5">{children}</p>
      </div>
    </div>
  );
}
