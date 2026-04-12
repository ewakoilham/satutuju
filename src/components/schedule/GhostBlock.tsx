"use client";

import { slotPos } from "./helpers";

interface GhostBlockProps {
  startTime: string;
  endTime: string;
  label?: string;       // optional label inside the ghost
  variant?: "create" | "book";
  isUnderMinimum?: boolean;  // amber feedback when dragged duration < 60 min
}

/**
 * Dashed-border preview block used for both mentor slot creation
 * and mentee booking preview. Always pointer-events-none.
 */
export default function GhostBlock({ startTime, endTime, label, variant = "create", isUnderMinimum }: GhostBlockProps) {
  const { top, height } = slotPos(startTime, endTime);
  const isBook = variant === "book";

  const bgCls = isUnderMinimum ? "bg-amber-200/50" : isBook ? "bg-blue-400/30" : "bg-blue-200/70";
  const borderCls = isUnderMinimum ? "border-amber-500" : isBook ? "border-blue-600" : "border-blue-500";
  const textCls = isUnderMinimum ? "text-amber-700" : "text-blue-700";

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded-md pointer-events-none overflow-hidden z-[5]"
      style={{ top, height }}
    >
      <div className={`absolute inset-0 ${bgCls}`} />
      <div className={`absolute inset-0 rounded-md border-2 border-dashed ${borderCls}`} />
      {label && (
        <p className={`relative text-[11px] font-semibold ${textCls} px-2 pt-1 truncate leading-tight`}>
          {label}
        </p>
      )}
      {isUnderMinimum && (
        <p className="relative text-[10px] text-amber-600 px-2 mt-0.5">min 60 min</p>
      )}
    </div>
  );
}
