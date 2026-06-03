"use client";

import { useMemo, useCallback } from "react";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/Modal";
import {
  useScheduleReducer,
  useScheduleData,
  useDragToCreate,
  DayColumn,
  computeGhostFromClick,
  snapCellClick,
  InlineCreateCard,
  EditSlotModal,
  BookingModal,
  SlotPopover,
  WeekToolbar,
  Legend,
  RecurringRulesCard,
  // helpers
  addDays,
  toDateStr,
  fmtDate,
  fmtHour,
  toMins,
  minsToTime,
  buildMentorColorMap,
  // constants
  HOUR_H,
  HOUR_START,
  TOTAL_H,
  DAY_ABBR,
  // types
  type Slot,
} from "@/components/schedule";

export default function SchedulePage() {
  const { user } = useUser();
  const [state, dispatch] = useScheduleReducer();
  const { slots, sessions, hasPairing, loading, weekStart, mentorFilter, mentors, mode } = state;

  const refresh = useScheduleData(user?.role, mentorFilter, dispatch);

  // Derived
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = toDateStr(new Date());
  const weekDateStrs = useMemo(() => weekDays.map(toDateStr), [weekDays]);
  const weekSlots = useMemo(() => slots.filter(s => weekDateStrs.includes(s.date)), [slots, weekDateStrs]);
  const mentorColorMap = useMemo(() => buildMentorColorMap(slots), [slots]);
  const pendingCount = useMemo(
    () => slots.reduce((n, s) => n + (s.bookings?.filter(b => b.status === "pending").length || 0), 0),
    [slots]
  );

  const isMentor = user?.role === "mentor";
  const isMentee = user?.role === "mentee";
  const isAdmin  = user?.role === "admin";

  // Drag-to-create hook (mentor only)
  const drag = useDragToCreate(user?.role, mode, weekSlots, dispatch);

  // ── API actions ─────────────────────────────────────────────────────────

  async function handleSaveNew(d: { date: string; startTime: string; endTime: string; notes: string }) {
    const res = await fetch("/api/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    await refresh();
  }

  async function handleSaveEdit(d: { date: string; startTime: string; endTime: string; notes: string }) {
    if (mode.type !== "editing") return;
    const res = await fetch(`/api/schedule/${mode.slot.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    dispatch({ type: "DISMISS" });
    await refresh();
  }

  async function handleDelete() {
    if (mode.type !== "deleting") return;
    await fetch(`/api/schedule/${mode.slot.id}`, { method: "DELETE" });
    dispatch({ type: "DISMISS" });
    await refresh();
  }

  async function handleBook(
    slotId: string,
    opts: { sessionId: string; requestedStart: string; requestedEnd: string; message: string }
  ) {
    const res = await fetch(`/api/schedule/${slotId}/book`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to request");
    dispatch({ type: "DISMISS" });
    await refresh();
  }

  async function handleBookingAction(slotId: string, bookingId: string, action: "accept" | "reject", reason?: string) {
    await fetch(`/api/schedule/${slotId}/book`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, action, ...(reason ? { rejectionReason: reason } : {}) }),
    });
    dispatch({ type: "DISMISS" });
    await refresh();
  }

  async function handleDismissRejection(slotId: string, bookingId: string) {
    await fetch(`/api/schedule/${slotId}/book`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    dispatch({ type: "DISMISS" });
    await refresh();
  }

  // ── Click handlers ──────────────────────────────────────────────────────

  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    if (!isMentor) return;
    // After a drag, skip the synthetic click
    if (drag.consumeSkipNextClick()) return;
    // If already in a mode, dismiss first
    if (mode.type !== "idle") { dispatch({ type: "DISMISS" }); return; }

    const daySlots = weekSlots.filter(s => s.date === dateStr);
    const snapped = snapCellClick(e, daySlots);
    // No free 60-min gap at this position — ignore the click
    if (!snapped) return;

    dispatch({
      type: "START_CREATING",
      date: dateStr,
      startTime: snapped.startTime,
      endTime: snapped.endTime,
      anchorX: e.clientX,
      anchorY: e.clientY,
    });
  }

  function handleSlotClick(e: React.MouseEvent, slot: Slot) {
    e.stopPropagation();

    if (isMentee) {
      // If slot is bookable and mentee has no booking, compute ghost position
      const hasAccepted = slot.bookings?.some(b => b.status === "accepted");
      if (!slot.myBooking && !hasAccepted) {
        const slotDuration = toMins(slot.endTime) - toMins(slot.startTime);
        if (slotDuration >= 90) {
          // Compute ghost from click position
          const { ghostStart, ghostEnd } = computeGhostFromClick(e, slot);
          dispatch({ type: "START_BOOKING", slot, ghostStart, ghostEnd });
          return;
        }
        // Slot < 90 min: show it as a single-window booking
        dispatch({
          type: "START_BOOKING", slot,
          ghostStart: slot.startTime,
          ghostEnd: minsToTime(Math.min(toMins(slot.startTime) + 90, toMins(slot.endTime))),
        });
        return;
      }
    }

    dispatch({ type: "VIEW_SLOT", slot, anchorX: e.clientX, anchorY: e.clientY });
  }

  const handleUpdateCreateTime = useCallback((st: string, et: string) => {
    dispatch({ type: "UPDATE_CREATE_TIME", startTime: st, endTime: et });
  }, [dispatch]);

  const handlePreviewChange = useCallback((startTime: string, endTime: string) => {
    dispatch({ type: "UPDATE_GHOST", startTime, endTime });
  }, [dispatch]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Schedule</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {isMentor && "Click any empty time slot to add your availability."}
            {isMentee && "Click a slot to request a session with your mentor."}
            {isAdmin  && "View all mentor schedules."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && mentors.length > 0 && (
            <Select
              value={mentorFilter}
              onChange={(v) => dispatch({ type: "SET_MENTOR_FILTER", value: v })}
              options={[
                { value: "", label: "All Mentors" },
                ...mentors.map(m => ({ value: m.id, label: m.name })),
              ]}
              className="text-sm py-1.5"
            />
          )}
          {isMentor && pendingCount > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
              <Icon name="bell" size={13} />
              {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            </span>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <WeekToolbar weekStart={weekStart} dispatch={dispatch} />

      {/* Legend */}
      <Legend role={user.role} mentors={mentors} mentorColorMap={mentorColorMap} />

      {/* Recurring availability (mentor only) */}
      {isMentor && <RecurringRulesCard onChanged={refresh} />}

      {/* No pairing (mentee) */}
      {isMentee && !hasPairing && (
        <div className="card text-center py-14 text-text-muted-2">
          <Icon name="calendar" size={32} className="mx-auto mb-3 text-text-muted-2" />
          <p className="text-sm font-medium">No active pairing found.</p>
          <p className="text-xs mt-1">You&apos;ll see your mentor&apos;s availability once you&apos;re paired.</p>
        </div>
      )}

      {/* Calendar grid */}
      {(!isMentee || hasPairing) && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>
              {/* Day headers */}
              <div className="grid border-b border-border"
                style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                <div className="border-r border-border" />
                {weekDays.map((day, i) => {
                  const ds = toDateStr(day);
                  const isToday = ds === today;
                  return (
                    <div key={i} className={`text-center py-3 border-r border-border last:border-r-0 ${isToday ? "bg-blue-50/40" : ""}`}>
                      <p className="text-[11px] text-text-muted-2 font-semibold uppercase tracking-wide">
                        {DAY_ABBR[day.getDay()]}
                      </p>
                      <div className={`text-lg font-bold mt-0.5 w-9 h-9 flex items-center justify-center rounded-full mx-auto leading-none ${
                        isToday ? "bg-blue-600 text-white" : "text-foreground"
                      }`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              {loading ? (
                <div className="p-6"><div className="h-80 bg-surface-elevated rounded-lg animate-pulse" /></div>
              ) : (
                <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                  {/* Hour labels */}
                  <div className="border-r border-border">
                    {Array.from({ length: TOTAL_H }, (_, i) => (
                      <div key={i} style={{ height: HOUR_H }}
                        className="relative border-b border-border/50 last:border-b-0">
                        <span className="absolute -top-2.5 right-2 text-[10px] text-text-muted-2 select-none">
                          {fmtHour(HOUR_START + i)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, i) => (
                    <DayColumn
                      key={i}
                      day={day}
                      today={today}
                      slots={weekSlots}
                      role={user.role}
                      mode={mode}
                      mentorColorMap={mentorColorMap}
                      onCellClick={handleCellClick}
                      onSlotClick={handleSlotClick}
                      onPointerDown={drag.handlePointerDown}
                      onPointerMove={drag.handlePointerMove}
                      onPointerUp={drag.handlePointerUp}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ───────────────────────────────────────────────────────── */}

      {/* Inline create card (mentor) */}
      {mode.type === "creating" && (
        <InlineCreateCard
          date={mode.date}
          startTime={mode.startTime}
          endTime={mode.endTime}
          anchorX={mode.anchorX}
          anchorY={mode.anchorY}
          existingSlots={weekSlots.filter(s => s.date === mode.date)}
          onClose={() => dispatch({ type: "DISMISS" })}
          onSave={handleSaveNew}
          onUpdateTime={handleUpdateCreateTime}
        />
      )}

      {/* Slot detail popover */}
      {mode.type === "viewing" && (
        <SlotPopover
          slot={mode.slot}
          role={user.role}
          x={mode.anchorX}
          y={mode.anchorY}
          mentorColor={isAdmin && mode.slot.mentorId ? mentorColorMap.get(mode.slot.mentorId) : undefined}
          onClose={() => dispatch({ type: "DISMISS" })}
          onEdit={() => dispatch({ type: "START_EDITING", slot: mode.slot })}
          onDelete={() => dispatch({ type: "START_DELETING", slot: mode.slot })}
          onBook={() => {
            // From popover "Request" button — use full slot as ghost
            const slot = mode.slot;
            dispatch({
              type: "START_BOOKING", slot,
              ghostStart: slot.startTime,
              ghostEnd: minsToTime(Math.min(toMins(slot.startTime) + 90, toMins(slot.endTime))),
            });
          }}
          onAccept={id => handleBookingAction(mode.slot.id, id, "accept")}
          onReject={(id, reason) => handleBookingAction(mode.slot.id, id, "reject", reason)}
          onDismissRejection={id => handleDismissRejection(mode.slot.id, id)}
        />
      )}

      {/* Edit slot modal */}
      <EditSlotModal
        open={mode.type === "editing"}
        initial={mode.type === "editing" ? {
          id: mode.slot.id,
          date: mode.slot.date,
          startTime: mode.slot.startTime,
          endTime: mode.slot.endTime,
          notes: mode.slot.notes,
        } : undefined}
        allSlots={slots}
        onClose={() => dispatch({ type: "DISMISS" })}
        onSave={handleSaveEdit}
      />

      {/* Booking modal (mentee) */}
      <BookingModal
        open={mode.type === "booking"}
        slot={mode.type === "booking" ? mode.slot : null}
        sessions={sessions}
        initialWindow={mode.type === "booking" ? { startTime: mode.ghostStart, endTime: mode.ghostEnd } : undefined}
        onClose={() => dispatch({ type: "DISMISS" })}
        onBook={handleBook}
        onPreviewChange={handlePreviewChange}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={mode.type === "deleting"}
        onClose={() => dispatch({ type: "DISMISS" })}
        onConfirm={handleDelete}
        title="Delete slot?"
        description={mode.type === "deleting"
          ? `Delete the slot on ${fmtDate(mode.slot.date)} (${mode.slot.startTime}\u2013${mode.slot.endTime})? Any pending bookings will be notified.`
          : ""}
        confirmLabel="Delete"
        variant="danger"
        loading={false}
      />
    </div>
  );
}
