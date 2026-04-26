"use client";

import Image from "next/image";
import type { Mentor } from "@/lib/mentors";

type Props = {
  mentor: Pick<Mentor, "fullName" | "initials" | "color" | "photo">;
  /** CSS sizes attribute passed to next/image. */
  sizes: string;
  /** Initials text size class — caller controls scale. */
  initialsClassName?: string;
  priority?: boolean;
};

/**
 * Render a mentor's photo with an initials-on-color fallback.
 * Used by hero featured card, hero compact card, hero avatar strip, and marquee cards.
 */
export default function MentorAvatar({
  mentor,
  sizes,
  initialsClassName = "text-base",
  priority = false,
}: Props) {
  if (mentor.photo) {
    return (
      <Image
        src={mentor.photo}
        alt={mentor.fullName}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    );
  }
  return (
    <div className={`w-full h-full ${mentor.color} flex items-center justify-center`}>
      <span
        className={`font-bold text-white/80 font-[family-name:var(--font-heading)] ${initialsClassName}`}
      >
        {mentor.initials}
      </span>
    </div>
  );
}
