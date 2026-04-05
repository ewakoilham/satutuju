"use client";

import { slotPos } from "./helpers";

interface GhostBlockProps {
  startTime: string;
  endTime: string;
  label?: string;       // optional label inside the ghost
  variant?: "create" | "book";
}

/**
 * Dashed-border preview block used for both mentor slot creation
 * and mentee booking preview. Always pointer-events-none.
 */
export default function GhostBlock({ startTime, endTime, label, variant = "create" }: GhostBlockProps) {
  const { top, height } = slotPos(startTime, endTime);
  const isBook = variant === "book";

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded-md pointer-events-none overflow-hidden z-[5]"
      style={{ top, height }}
    >
      <div className={`absolute inset-0 ${isBook ? "bg-blue-400/30" : "bg-blue-200/70"}`} />
      <div className={`absolute inset-0 rounded-md border-2 border-dashed ${isBook ? "border-blue-600" : "border-blue-500"}`} />
      {label && (
        <p className="relative text-[11px] font-semibold text-blue-700 px-2 pt-1 truncate leading-tight">
          {label}
        </p>
      )}
    </div>
  );
}
