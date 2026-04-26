"use client";

import Image from "next/image";
import { useState } from "react";

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

interface UniversityLogoMarqueeProps {
  caption?: string;
  trailing?: string;
}

export default function UniversityLogoMarquee({
  caption = "Tujuan studi mentee kami:",
  trailing = "+ 3000 universitas mitra di seluruh dunia",
}: UniversityLogoMarqueeProps) {
  const [paused, setPaused] = useState(false);
  const doubled = [...PARTNER_UNIVERSITIES, ...PARTNER_UNIVERSITIES];

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-[0.12em] text-primary-700/70 font-semibold mb-3">
        {caption}
      </p>

      <div
        className="relative overflow-hidden group py-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Edge gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

        <div
          className="flex items-center gap-14 animate-marquee whitespace-nowrap"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
          {doubled.map((u, i) => (
            <div
              key={`${u.slug}-${i}`}
              className="flex-shrink-0 h-16 w-44 relative hover:scale-105 transition-transform duration-300"
              title={u.name}
            >
              <Image
                src={`/universities/${u.slug}.${u.ext}`}
                alt={u.name}
                fill
                className="object-contain"
                sizes="176px"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-muted mt-3">
        <span className="font-medium text-foreground">{trailing}</span>
      </p>
    </div>
  );
}
