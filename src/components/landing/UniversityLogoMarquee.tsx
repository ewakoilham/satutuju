"use client";

import Image from "next/image";

interface University {
  name: string;
  slug: string;
  ext: "svg" | "png" | "jpg";
}

const PARTNER_UNIVERSITIES: University[] = [
  { name: "King's College London", slug: "kings-college-london", ext: "svg" },
  { name: "University of Melbourne", slug: "melbourne", ext: "svg" },
  { name: "Monash University", slug: "monash", ext: "svg" },
  { name: "University of Warwick", slug: "warwick", ext: "svg" },
  { name: "University of Edinburgh", slug: "edinburgh", ext: "svg" },
  { name: "Johns Hopkins University", slug: "johns-hopkins", ext: "svg" },
  { name: "University of Auckland", slug: "auckland", ext: "svg" },
  { name: "Aalto University", slug: "aalto", ext: "png" },
  { name: "University of British Columbia", slug: "ubc", ext: "svg" },
  { name: "University of Sydney", slug: "sydney", ext: "svg" },
  { name: "UNSW Sydney", slug: "unsw", ext: "jpg" },
  { name: "University of Manchester", slug: "manchester", ext: "svg" },
  { name: "University of Glasgow", slug: "glasgow", ext: "svg" },
  { name: "University College Dublin", slug: "ucd", ext: "svg" },
  { name: "BHMS", slug: "bhms", ext: "jpg" },
];

export default function UniversityLogoMarquee() {
  // Doubled so the -50% keyframe end-state is visually identical to the
  // start — produces a seamless infinite scroll.
  const doubled = [...PARTNER_UNIVERSITIES, ...PARTNER_UNIVERSITIES];

  return (
    <section className="bg-white border-y border-border/60 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-2 flex items-center justify-between gap-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary-700/70 font-semibold">
          Mentor pilihan, dari kampus terbaik di dunia
        </p>
        <p className="text-[11px] text-text-muted">
          <span className="font-medium text-foreground">3.000+ universitas mitra di seluruh dunia</span>
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

        <div className="flex items-center animate-marquee whitespace-nowrap">
          {doubled.map((u, i) => (
            <div
              key={`${u.slug}-${i}`}
              // mr-12 (instead of gap-12 on the parent) ensures every item —
              // including the last one of each set — carries the same spacer,
              // so the -50% loop point lines up exactly with the start.
              className="flex-shrink-0 h-10 w-32 mr-12 relative opacity-80 hover:opacity-100 transition-opacity duration-300"
              title={u.name}
            >
              <Image
                src={`/universities/${u.slug}.${u.ext}`}
                alt={u.name}
                fill
                className="object-contain"
                sizes="128px"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom eyebrow — these same universities are also the destinations
          our mentees aim for. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary-700/70 font-semibold">
          Kampus tujuan mentee kita
        </p>
      </div>
    </section>
  );
}
