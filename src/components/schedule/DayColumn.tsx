"use client";

import { HOUR_H, HOUR_START, HOUR_END, TOTAL_H, SNAP_MINS } from "./constants";
import { toDateStr, toMins, minsToTime, computeDayLayout, buildBusy, clampToFreeGap } from "./helpers";
import type { Slot, Mode } from "./types";
import NowLine from "./NowLine";
import GhostBlock from "./GhostBlock";
import SlotBlock from "./SlotBlock";

interface DayColumnProps {
  day: Date;
  today: string;
  slots: Slot[];
  role: string;
  mode: Mode;
  mentorColorMap: Map<string, string>;
  onCellClick: (e: React.MouseEvent<HTMLDivElement>, dateStr: string) => void;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>, dateStr: string) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export default function DayColumn({
  day, today, slots, role, mode, mentorColorMap,
  onCellClick, onSlotClick,
  onPointerDown, onPointerMove, onPointerUp,
}: DayColumnProps) {
  const dateStr = toDateStr(day);
  const isToday = dateStr === today;
  const daySlots = slots.filter(s => s.date === dateStr);
  const layout = computeDayLayout(daySlots);

  const isMentor = role === "mentor";
  const isAdmin  = role === "admin";

  // Ghost block for dragging or creating (mentor)
  const showDragGhost   = mode.type === "dragging" && mode.date === dateStr;
  const showCreateGhost = mode.type === "creating" && mode.date === dateStr;
  // Ghost block for booking (mentee)
  const showBookGhost = mode.type === "booking" && mode.slot.date === dateStr;

  // Under-minimum feedback during drag (< 60 min)
  const dragUnderMin = showDragGhost && mode.type === "dragging"
    ? (toMins(mode.endTime) - toMins(mode.startTime)) < 60
    : false;

  // Determine selected slot for highlight
  const selectedSlotId = (mode.type === "viewing" ? mode.slot.id : null);

  return (
    <div
      className={`relative border-r border-border last:border-r-0 ${
        isToday ? "bg-blue-50/20" : ""
      } ${isMentor ? "cursor-pointer" : ""}`}
      style={{ height: TOTAL_H * HOUR_H, touchAction: isMentor ? "none" : undefined }}
      onClick={e => onCellClick(e, dateStr)}
      onPointerDown={onPointerDown ? e => onPointerDown(e, dateStr) : undefined}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Hour grid lines */}
      {Array.from({ length: TOTAL_H }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border"
          style={{ top: i * HOUR_H }} />
      ))}
      {/* Half-hour lines */}
      {Array.from({ length: TOTAL_H }, (_, i) => (
        <div key={`h${i}`} className="absolute left-0 right-0 border-t border-border/50"
          style={{ top: i * HOUR_H + HOUR_H / 2 }} />
      ))}

      {/* Hover tint for mentor */}
      {isMentor && (
        <div className="absolute inset-0 hover:bg-blue-500/5 transition-colors pointer-events-none" />
      )}

      {/* Current time indicator */}
      {isToday && <NowLine />}

      {/* Ghost: drag preview */}
      {showDragGhost && mode.type === "dragging" && (
        <GhostBlock
          startTime={mode.startTime}
          endTime={mode.endTime}
          label={`${mode.startTime}\u2013${mode.endTime}`}
          variant="create"
          isUnderMinimum={dragUnderMin}
        />
      )}

      {/* Ghost: mentor creation */}
      {showCreateGhost && mode.type === "creating" && (
        <GhostBlock
          startTime={mode.startTime}
          endTime={mode.endTime}
          label={`${mode.startTime}\u2013${mode.endTime}`}
          variant="create"
        />
      )}

      {/* Ghost: mentee booking preview */}
      {showBookGhost && mode.type === "booking" && (
        <GhostBlock
          startTime={mode.ghostStart}
          endTime={mode.ghostEnd}
          variant="book"
        />
      )}

      {/* Slot blocks */}
      {layout.map(({ slot, col, totalCols }) => (
        <SlotBlock
          key={slot.id}
          slot={slot}
          role={role}
          col={col}
          totalCols={totalCols}
          isSelected={slot.id === selectedSlotId}
          mentorColor={isAdmin && slot.mentorId ? mentorColorMap.get(slot.mentorId) : undefined}
          onClick={e => onSlotClick(e, slot)}
        />
      ))}
    </div>
  );
}

// ── Helper: compute ghost start/end from click Y position on a slot ──────

export function computeGhostFromClick(
  e: React.MouseEvent,
  slot: Slot
): { ghostStart: string; ghostEnd: string } {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const relY = e.clientY - rect.top;
  const clickMins = toMins(slot.startTime) + (relY / HOUR_H) * 60;
  const slotStartMins = toMins(slot.startTime);
  const slotEndMins = toMins(slot.endTime);
  const snapped = Math.round(clickMins / SNAP_MINS) * SNAP_MINS;
  const maxStart = Math.max(slotStartMins, slotEndMins - 90);
  const ghostStart = Math.max(slotStartMins, Math.min(snapped, maxStart));
  const ghostEnd = Math.min(ghostStart + 90, slotEndMins);
  return { ghostStart: minsToTime(ghostStart), ghostEnd: minsToTime(ghostEnd) };
}

/**
 * Snap a cell click to the nearest free 60-min gap.
 * - If the click lands inside an existing slot, start is pushed to that slot's end.
 * - End is capped at the next slot's start (never overlapping).
 * - Returns null if there is no 60-min free gap at or after the clicked position.
 */
export function snapCellClick(
  e: React.MouseEvent<HTMLDivElement>,
  daySlots: Slot[]
): { startTime: string; endTime: string } | null {
  const rect = e.currentTarget.getBoundingClientRect();
  const relY = e.clientY - rect.top;
  const rawMins = HOUR_START * 60 + (relY / HOUR_H) * 60;
  const snappedMins = Math.floor(rawMins / SNAP_MINS) * SNAP_MINS;

  const busy = buildBusy(daySlots);
  const result = clampToFreeGap(snappedMins, busy);
  if (!result) return null;

  return {
    startTime: minsToTime(result.start),
    endTime: minsToTime(result.end),
  };
}
