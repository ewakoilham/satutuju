"use client";

import { useRef, useCallback } from "react";
import { HOUR_START, HOUR_H, SNAP_MINS } from "./constants";
import { toMins, minsToTime, buildBusy, clampEndToGap } from "./helpers";
import type { Slot, Mode, ScheduleAction } from "./types";

/**
 * Google Calendar-style drag-to-create for mentors.
 * Returns pointer event handlers to attach to each DayColumn.
 *
 * Drag behaviour:
 *  - PointerDown on empty space → START_DRAG at snapped 30-min row
 *  - PointerMove → UPDATE_DRAG with clamped endTime
 *  - PointerUp  → if drag was < 5px (click), dismiss & let click handler fire
 *                  otherwise FINISH_DRAG → transitions to "creating" mode
 */
export function useDragToCreate(
  role: string | undefined,
  mode: Mode,
  weekSlots: Slot[],
  dispatch: React.Dispatch<ScheduleAction>,
) {
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragDateRef = useRef("");
  const dragStartMins = useRef(0);
  const busyRef = useRef<ReturnType<typeof buildBusy>>([]);
  const rafRef = useRef(0);
  const skipNextClick = useRef(false);

  const isMentor = role === "mentor";

  const yToSnappedMins = useCallback((relY: number) => {
    const rawMins = HOUR_START * 60 + (relY / HOUR_H) * 60;
    return Math.floor(rawMins / SNAP_MINS) * SNAP_MINS;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dateStr: string) => {
      if (!isMentor) return;
      if (mode.type !== "idle") return;
      // Only primary button
      if (e.button !== 0) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const snappedMins = yToSnappedMins(relY);

      // Build busy intervals for this day
      const daySlots = weekSlots.filter(s => s.date === dateStr);
      const busy = buildBusy(daySlots);

      // Don't start drag if clicking inside a busy slot
      for (const b of busy) {
        if (snappedMins >= b.start && snappedMins < b.end) return;
      }

      dragging.current = true;
      dragStartY.current = e.clientY;
      dragDateRef.current = dateStr;
      dragStartMins.current = snappedMins;
      busyRef.current = busy;

      e.currentTarget.setPointerCapture(e.pointerId);

      const endMins = snappedMins + SNAP_MINS;
      dispatch({
        type: "START_DRAG",
        date: dateStr,
        startTime: minsToTime(snappedMins),
        endTime: minsToTime(endMins),
      });
    },
    [isMentor, mode.type, weekSlots, dispatch, yToSnappedMins],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const rawEndMins = yToSnappedMins(relY) + SNAP_MINS;

        // Clamp: minimum is start + 30min, respect busy boundaries
        const startMins = dragStartMins.current;
        const clamped = clampEndToGap(
          startMins,
          Math.max(rawEndMins, startMins + SNAP_MINS),
          busyRef.current,
          SNAP_MINS, // minDur = 30 during drag (we enforce 60 on release)
          90,
        );

        dispatch({ type: "UPDATE_DRAG", endTime: minsToTime(clamped) });
      });
    },
    [dispatch, yToSnappedMins],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      cancelAnimationFrame(rafRef.current);

      const totalMovement = Math.abs(e.clientY - dragStartY.current);

      if (totalMovement < 5) {
        // Treat as click — dismiss drag, let the onClick handler fire
        dispatch({ type: "DISMISS" });
        return;
      }

      // Drag completed — enforce minimum 60 min
      if (mode.type === "dragging") {
        const startMins = toMins(mode.startTime);
        let endMins = toMins(mode.endTime);
        const duration = endMins - startMins;

        if (duration < 60) {
          // Auto-extend to 60 min if gap allows
          const extended = clampEndToGap(
            startMins,
            startMins + 60,
            busyRef.current,
            60,
            90,
          );
          if (extended <= startMins + SNAP_MINS) {
            // Not enough space — cancel
            dispatch({ type: "DISMISS" });
            return;
          }
          endMins = extended;
          dispatch({ type: "UPDATE_DRAG", endTime: minsToTime(endMins) });
        }
      }

      skipNextClick.current = true;
      dispatch({ type: "FINISH_DRAG", anchorX: e.clientX, anchorY: e.clientY });
    },
    [mode, dispatch],
  );

  return { handlePointerDown, handlePointerMove, handlePointerUp, skipNextClick };
}
