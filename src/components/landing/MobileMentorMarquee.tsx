"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "@/components/ui/Icon";
import EditableMentorPhoto from "./EditableMentorPhoto";
import { MENTORS, type Mentor } from "@/lib/mentors";
import mentorsData from "@/data/mentors.json";
import MentorBioModal, { type MentorBio } from "./MentorBioModal";
import { useEditPanelOpen, useMentorNickname } from "@/lib/photo-edit-context";

const AUTO_CYCLE_MS = 5000;
const MANUAL_COOLDOWN_MS = 4000;

/**
 * Mobile-only mentor showcase — Claude Design "Mobile Mentor Showcase".
 * Sibling of the desktop `MentorMarquee`; rendered exclusively below the lg
 * breakpoint by `LandingPage`. Carousel + filter + pager + thumb strip,
 * cards open the existing MentorBioModal.
 */
type CountryFilter = "all" | "Australia" | "United Kingdom" | "New Zealand" | "Netherlands";

const FILTERS: { id: CountryFilter; label: string; flag: string }[] = [
  { id: "all", label: "Semua", flag: "🌏" },
  { id: "Australia", label: "Australia", flag: "🇦🇺" },
  { id: "United Kingdom", label: "UK", flag: "🇬🇧" },
  { id: "New Zealand", label: "NZ", flag: "🇳🇿" },
  { id: "Netherlands", label: "Belanda", flag: "🇳🇱" },
];

/** Find the index of the rail child whose centre is closest to the rail's
 *  visible centre. Returns 0 if the rail has no children. */
function findCenterNearestCard(el: HTMLDivElement): number {
  if (!el.children.length) return 0;
  const center = el.scrollLeft + el.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i] as HTMLElement;
    const cc = c.offsetLeft + c.clientWidth / 2;
    const d = Math.abs(cc - center);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export default function MobileMentorMarquee() {
  const [filter, setFilter] = useState<CountryFilter>("all");
  const [active, setActive] = useState(0);
  const [openBio, setOpenBio] = useState<MentorBio | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const lockScrollSync = useRef(false);
  // Auto-cycle pauses for this duration after any manual interaction
  // (swipe, prev/next, dot tap, thumb tap).
  const cooldownUntilRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const editPanelOpen = useEditPanelOpen();

  const filtered = useMemo<Mentor[]>(() => {
    if (filter === "all") return MENTORS;
    return MENTORS.filter((m) => m.country === filter);
  }, [filter]);

  const scrollToCard = useCallback((idx: number, smooth = true) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.children[idx] as HTMLElement | undefined;
    if (!card) return;
    lockScrollSync.current = true;
    const target = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    el.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
    setTimeout(
      () => {
        lockScrollSync.current = false;
      },
      smooth ? 420 : 60,
    );
  }, []);

  // Reset active when filter changes
  useEffect(() => {
    setActive(0);
    requestAnimationFrame(() => scrollToCard(0, false));
  }, [filter, scrollToCard]);

  const bumpCooldown = useCallback(() => {
    cooldownUntilRef.current = Date.now() + MANUAL_COOLDOWN_MS;
  }, []);

  const onRailScroll = useCallback(() => {
    if (lockScrollSync.current) return;
    // rAF-throttle so the O(n) center-find runs at most once per paint
    // frame, not on every scroll event (touch swipes fire ~60×/sec).
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = railRef.current;
      if (!el) return;
      const best = findCenterNearestCard(el);
      if (best !== active) {
        setActive(best);
        // Real user swipe (lockScrollSync was false) — pause auto-cycle.
        bumpCooldown();
      }
    });
  }, [active, bumpCooldown]);

  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    },
    [],
  );

  const goPrev = () => {
    const i = Math.max(0, active - 1);
    setActive(i);
    scrollToCard(i);
    bumpCooldown();
  };
  const goNext = () => {
    const i = Math.min(filtered.length - 1, active + 1);
    setActive(i);
    scrollToCard(i);
    bumpCooldown();
  };

  const openMentorBio = (m: Mentor) => {
    const bio = (mentorsData as MentorBio[]).find((mm) => mm.fullName === m.fullName);
    if (bio) setOpenBio(bio);
  };

  // Auto-cycle — advances the active card every AUTO_CYCLE_MS while the bio
  // modal is closed, no edit panel is open, and the user hasn't recently
  // interacted with the rail.
  useEffect(() => {
    if (openBio || editPanelOpen || filtered.length <= 1) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (Date.now() < cooldownUntilRef.current) return;
      const el = railRef.current;
      if (!el) return;
      // Read the rail's current centre rather than the stale `active` closure —
      // avoids drift if React batched a recent setActive.
      const next = (findCenterNearestCard(el) + 1) % filtered.length;
      setActive(next);
      scrollToCard(next, true);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(id);
  }, [openBio, editPanelOpen, filtered.length, scrollToCard]);

  return (
    <section
      id="mentor-showcase"
      className="relative overflow-hidden text-white scroll-mt-20"
      style={{
        background:
          "radial-gradient(600px 400px at 80% -10%, #1a2d60 0%, transparent 60%), radial-gradient(500px 300px at -10% 110%, #233a7d 0%, transparent 55%), #111d42",
      }}
    >
      <div className="relative z-10 pt-7 pb-8">
        {/* Header */}
        <div className="px-5 mb-3.5 text-center">
          <div className="flex justify-center mb-3.5">
            <div
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[10.5px] font-semibold tracking-[0.15em] uppercase"
              style={{
                color: "#c6ddef",
                background: "rgba(198,221,239,0.08)",
                border: "1px solid rgba(198,221,239,0.18)",
              }}
            >
              Mentor pilihan kamu
            </div>
          </div>
          <h2 className="font-[family-name:var(--font-heading)] text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-white mb-2">
            Mereka udah pernah di{" "}
            <em className="font-normal italic text-[#fef3d0] font-[family-name:var(--font-display-serif)]">
              posisi kamu sekarang.
            </em>
          </h2>
          <p className="text-[13.5px] leading-[1.5] text-white/70 max-w-[340px] mx-auto">
            Geser, pilih siapa yang bikin kamu penasaran, terus tap kartunya buat baca cerita lengkap mereka.
          </p>
        </div>

        {/* Country filter chips */}
        <div
          className="flex gap-1.5 overflow-x-auto px-5 pb-1 mb-3.5"
          style={{ scrollbarWidth: "none" }}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border ${
                  isActive
                    ? "bg-[#fef3d0] text-primary-900 border-[#fef3d0]"
                    : "bg-white/[0.06] text-white/85 border-white/[0.12]"
                }`}
              >
                <span>{f.flag}</span>
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Carousel */}
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-white/60 text-[13px]">
            Belum ada mentor di <b className="text-white">{filter}</b>. Coba negara lain.
          </div>
        ) : (
          <>
            <div className="relative">
              {filtered.length > 1 && active > 0 && (
                <button
                  type="button"
                  className="absolute top-1/2 -translate-y-1/2 z-10 left-2 w-10 h-10 rounded-full bg-white/[0.14] backdrop-blur-md border border-white/[0.22] text-white flex items-center justify-center"
                  onClick={goPrev}
                  aria-label="Mentor sebelumnya"
                >
                  <Icon name="chevron-left" size={18} />
                </button>
              )}
              {filtered.length > 1 && active < filtered.length - 1 && (
                <button
                  type="button"
                  className="absolute top-1/2 -translate-y-1/2 z-10 right-2 w-10 h-10 rounded-full bg-white/[0.14] backdrop-blur-md border border-white/[0.22] text-white flex items-center justify-center"
                  onClick={goNext}
                  aria-label="Mentor berikutnya"
                >
                  <Icon name="chevron-right" size={18} />
                </button>
              )}
              <div
                ref={railRef}
                onScroll={onRailScroll}
                className="flex gap-3 overflow-x-auto px-5 pt-1 pb-4"
                style={{
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {filtered.map((m) => (
                  <ShowcaseCard
                    key={m.id}
                    mentor={m}
                    onOpenBio={() => openMentorBio(m)}
                  />
                ))}
              </div>
            </div>

            {/* Pager dots */}
            <div className="flex items-center justify-center gap-1.5 px-5 pt-1 pb-4">
              {filtered.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    scrollToCard(i);
                    bumpCooldown();
                  }}
                  aria-label={`Mentor ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === active
                      ? "w-[22px] h-[6px] bg-[#fef3d0]"
                      : "w-[6px] h-[6px] bg-white/[0.22]"
                  }`}
                />
              ))}
            </div>

            {/* Thumb strip header */}
            <div className="flex items-center justify-between px-5 pb-2 text-[11px] tracking-[0.12em] uppercase font-semibold">
              <span className="text-white/45">Lompat ke mentor</span>
              <span className="text-white/45">
                <b className="text-white font-bold">
                  {filtered[active]?.nickname}
                </b>
              </span>
            </div>
            <div
              className="flex gap-2 overflow-x-auto px-5 pb-1.5"
              style={{ scrollbarWidth: "none" }}
            >
              {filtered.map((m, i) => (
                <ThumbButton
                  key={m.id}
                  mentor={m}
                  isActive={i === active}
                  onClick={() => {
                    setActive(i);
                    scrollToCard(i);
                    bumpCooldown();
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <MentorBioModal
        mentor={openBio}
        open={!!openBio}
        onClose={() => setOpenBio(null)}
      />
    </section>
  );
}

function ShowcaseCard({
  mentor,
  onOpenBio,
}: {
  mentor: Mentor;
  onOpenBio: () => void;
}) {
  const nickname = useMentorNickname(mentor.id, mentor.nickname);
  return (
    // Card itself is no longer clickable — leaves the whole surface free for
    // native horizontal swipe without accidental tap-to-open. Only the CTA
    // button at the bottom opens the bio modal.
    <div
      className="flex-shrink-0 relative aspect-[3/4.4] rounded-[22px] overflow-hidden bg-[#0d1638] border border-white/[0.08]"
      style={{
        flex: "0 0 calc(100% - 56px)",
        scrollSnapAlign: "center",
        scrollSnapStop: "always",
        boxShadow: "0 18px 40px -14px rgba(0,0,0,0.55)",
      }}
    >
      <EditableMentorPhoto
        mentorId={mentor.id}
        location="marquee-card"
        fallbackPhoto={mentor.photo ?? ""}
        alt={mentor.fullName}
        sizes="(max-width: 1024px) 90vw, 320px"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(17,29,66,0) 30%, rgba(17,29,66,0.55) 60%, rgba(17,29,66,0.96) 100%)",
        }}
      />

      {/* Flag chip */}
      <span className="absolute top-3.5 left-3.5 z-10 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-primary-900/55 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-white">
        {mentor.flagCode && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://flagcdn.com/24x18/${mentor.flagCode}.png`}
              srcSet={`https://flagcdn.com/24x18/${mentor.flagCode}.png 1x, https://flagcdn.com/48x36/${mentor.flagCode}.png 2x`}
              width={18}
              height={14}
              alt=""
              aria-hidden
              className="rounded-[2px]"
            />
          </>
        )}
        {mentor.country}
      </span>

      {/* Meta */}
      <div className="absolute left-[18px] right-[18px] bottom-[70px] z-10">
        <h3 className="font-[family-name:var(--font-heading)] text-[22px] font-bold leading-[1.15] tracking-[-0.015em] mb-1 text-white">
          {mentor.fullName}
        </h3>
        <p className="font-[family-name:var(--font-display-serif)] italic text-base text-[#fef3d0] leading-[1.2] mb-1.5">
          {mentor.major}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-white/[0.78]">
          <Icon name="graduation" size={11} />
          {mentor.university}
        </span>
      </div>

      {/* CTA — the only interactive element on the card */}
      <button
        type="button"
        onClick={onOpenBio}
        className="absolute left-3.5 right-3.5 bottom-3.5 z-10 inline-flex items-center justify-between px-4 py-2.5 rounded-[14px] bg-[#fef3d0] text-primary-900 font-[family-name:var(--font-heading)] text-[13px] font-bold active:scale-[0.98] transition-transform"
      >
        <span>Baca cerita {nickname}</span>
        <Icon name="arrow-right" size={14} />
      </button>
    </div>
  );
}

function ThumbButton({
  mentor,
  isActive,
  onClick,
}: {
  mentor: Mentor;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={mentor.fullName}
      className={`flex-shrink-0 relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-200 ${
        isActive
          ? "border-[#fef3d0] opacity-100 scale-[1.06]"
          : "border-transparent opacity-55"
      }`}
    >
      <EditableMentorPhoto
        mentorId={mentor.id}
        location="hero-avatar"
        fallbackPhoto={mentor.photo ?? ""}
        alt={mentor.fullName}
        sizes="56px"
      />
      {/* mini flag badge in the lower-right corner */}
      {mentor.flagCode && (
        <span className="absolute -right-0.5 -bottom-0.5 w-[18px] h-[18px] rounded-full bg-primary-900 border-2 border-primary-900 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/24x18/${mentor.flagCode}.png`}
            width={14}
            height={11}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
          />
        </span>
      )}
    </button>
  );
}
