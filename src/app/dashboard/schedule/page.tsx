"use client";

import { useMemo, useCallback, useState } from "react";
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

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const sameYear  = weekStart.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${weekStart.getDate()} — ${end.getDate()} ${ID_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${weekStart.getDate()} ${ID_MONTHS[weekStart.getMonth()]} — ${end.getDate()} ${ID_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${ID_MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()} — ${end.getDate()} ${ID_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function isCurrentWeek(weekStart: Date, now: Date): boolean {
  const ws = new Date(weekStart);
  ws.setHours(0, 0, 0, 0);
  const we = addDays(ws, 7);
  return now >= ws && now < we;
}

export default function SchedulePage() {
  const { user } = useUser();
  const [state, dispatch] = useScheduleReducer();
  const { slots, sessions, hasPairing, loading, weekStart, mentorFilter, mentors, mode } = state;

  const refresh = useScheduleData(user?.role, mentorFilter, dispatch);

  // View mode is decorative for now — the calendar always renders week view.
  // Hari / Bulan / Agenda are wired as disabled placeholders so the design's
  // tab pattern is visible without us shipping incomplete views.
  const [viewMode] = useState<"minggu">("minggu");

  // Derived
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = toDateStr(new Date());
  const weekDateStrs = useMemo(() => weekDays.map(toDateStr), [weekDays]);
  const weekSlots = useMemo(() => slots.filter((s) => weekDateStrs.includes(s.date)), [slots, weekDateStrs]);
  const mentorColorMap = useMemo(() => buildMentorColorMap(slots), [slots]);

  const pendingCount = useMemo(
    () => slots.reduce((n, s) => n + (s.bookings?.filter((b) => b.status === "pending").length || 0), 0),
    [slots],
  );

  // Quick-stats: scope to the visible week.
  const stats = useMemo(() => {
    let availableMins = 0;
    let bookedCount = 0;
    let pendingThisWeek = 0;
    let completedThisWeek = 0;
    for (const s of weekSlots) {
      const slotMins = toMins(s.endTime) - toMins(s.startTime);
      const bookings = s.bookings || [];
      const hasBooking = bookings.some((b) => b.status === "accepted" || b.status === "pending");
      if (!hasBooking) {
        availableMins += slotMins;
      }
      for (const b of bookings) {
        if (b.status === "accepted") bookedCount++;
        if (b.status === "pending") pendingThisWeek++;
      }
      // Completed = past slot with an accepted booking (heuristic).
      if (s.date < today && bookings.some((b) => b.status === "accepted")) {
        completedThisWeek++;
      }
    }
    return {
      availableHours: Math.round(availableMins / 60),
      bookedCount,
      pendingThisWeek,
      completedThisWeek,
    };
  }, [weekSlots, today]);

  const isMentor = user?.role === "mentor";
  const isMentee = user?.role === "mentee";
  const isAdmin = user?.role === "admin";

  // Drag-to-create hook (mentor only)
  const drag = useDragToCreate(user?.role, "minggu" === viewMode ? state.mode : state.mode, weekSlots, dispatch);

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
    opts: { sessionId: string; requestedStart: string; requestedEnd: string; message: string },
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
    if (drag.skipNextClick.current) { drag.skipNextClick.current = false; return; }
    if (mode.type !== "idle") { dispatch({ type: "DISMISS" }); return; }

    const daySlots = weekSlots.filter((s) => s.date === dateStr);
    const snapped = snapCellClick(e, daySlots);
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
      const hasAccepted = slot.bookings?.some((b) => b.status === "accepted");
      if (!slot.myBooking && !hasAccepted) {
        const slotDuration = toMins(slot.endTime) - toMins(slot.startTime);
        if (slotDuration >= 90) {
          const { ghostStart, ghostEnd } = computeGhostFromClick(e, slot);
          dispatch({ type: "START_BOOKING", slot, ghostStart, ghostEnd });
          return;
        }
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

  const showingCurrentWeek = isCurrentWeek(weekStart, new Date());

  const subtitle =
    isMentor ? "Klik slot kosong untuk buka, klik sesi yang sudah ada untuk edit. Auto-sync ke Google Calendar."
      : isMentee ? "Pilih slot mentor kamu untuk request sesi."
      : "Pantau jadwal semua mentor di satu tempat.";

  return (
    <>
      {/* ── Page head ──────────────────────────────────────────────── */}
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">
            {isMentor ? "Mentor" : isMentee ? "Mentee" : "Admin"}
          </div>
          <h1 className="sesi-title">
            Jadwal{" "}
            <span className="lede">
              — {isMentor ? "ketersediaan kamu" : isMentee ? "pilih slot mentor" : "semua mentor"}
              {showingCurrentWeek ? " minggu ini" : ""}.
            </span>
          </h1>
          <p className="sesi-sub">{subtitle}</p>
        </div>
        {isAdmin && mentors.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select
              value={mentorFilter}
              onChange={(v) => dispatch({ type: "SET_MENTOR_FILTER", value: v })}
              options={[
                { value: "", label: "All Mentors" },
                ...mentors.map((m) => ({ value: m.id, label: m.name })),
              ]}
              className="text-sm py-1.5"
            />
          </div>
        )}
      </div>

      {/* ── Quick stats ────────────────────────────────────────────── */}
      <div className="quick-stats">
        <div className="quick-stat">
          <div className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 9h18" />
            </svg>
          </div>
          <div>
            <div className="lbl">Slot tersedia</div>
            <div className="val">{stats.availableHours} <span className="unit">jam</span></div>
          </div>
        </div>
        <div className="quick-stat t-good">
          <div className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="lbl">Dibooking</div>
            <div className="val">{String(stats.bookedCount).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="quick-stat t-warn">
          <div className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <div className="lbl">Pending konfirmasi</div>
            <div className="val">{String(stats.pendingThisWeek).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="quick-stat t-blue">
          <div className="ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="m23 7-7 5 7 5V7Z" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </div>
          <div>
            <div className="lbl">Selesai · minggu ini</div>
            <div className="val">{String(stats.completedThisWeek).padStart(2, "0")}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="jadwal-toolbar">
        <div className="nav-wk">
          <button type="button" title="Minggu lalu" onClick={() => dispatch({ type: "PREV_WEEK" })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="today" onClick={() => dispatch({ type: "TODAY" })}>
            Hari ini
          </button>
          <button type="button" title="Minggu depan" onClick={() => dispatch({ type: "NEXT_WEEK" })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <span className="week-label">
          {fmtWeekLabel(weekStart)}
          {showingCurrentWeek && <span className="accent"> · minggu ini</span>}
        </span>
        <span className="spacer" />
        {isMentor && pendingCount > 0 && (
          <span className="db-pill warn static" style={{ cursor: "default" }}>
            <Icon name="bell" size={13} />
            {pendingCount} request menunggu
          </span>
        )}
        <div className="mode-tabs" role="tablist">
          <button type="button" role="tab" disabled title="Mode harian segera">Hari</button>
          <button type="button" role="tab" className="on">Minggu</button>
          <button type="button" role="tab" disabled title="Mode bulanan segera">Bulan</button>
          <button type="button" role="tab" disabled title="Mode agenda segera">Agenda</button>
        </div>
      </div>

      {/* ── Calendar + side rail ───────────────────────────────────── */}
      <div className="cal-split">
        <div className="cal-card">
          {/* No active pairing (mentee) */}
          {isMentee && !hasPairing ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "var(--text-muted-2)" }}>
              <Icon name="calendar" size={32} className="mx-auto mb-3" />
              <p style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>Belum ada pairing aktif.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                Kamu akan lihat ketersediaan mentor setelah dipasangkan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 640 }}>
                {/* Day headers */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}
                >
                  <div style={{ borderRight: "1px solid var(--border)" }} />
                  {weekDays.map((day, i) => {
                    const ds = toDateStr(day);
                    const isToday = ds === today;
                    return (
                      <div
                        key={i}
                        className={isToday ? "head-cell-today" : ""}
                        style={{
                          textAlign: "center",
                          padding: "12px 0",
                          borderRight: i < 6 ? "1px solid var(--border)" : undefined,
                          background: isToday ? "var(--primary-50)" : undefined,
                        }}
                      >
                        <p style={{
                          fontSize: 11,
                          color: "var(--text-muted-2)",
                          fontFamily: "var(--font-poppins)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          margin: 0,
                        }}>
                          {DAY_ABBR[day.getDay()]}
                        </p>
                        <div style={{
                          fontFamily: "var(--font-poppins)",
                          fontWeight: 800,
                          fontSize: 18,
                          letterSpacing: "-0.01em",
                          color: isToday ? "var(--primary)" : "var(--primary-900)",
                          marginTop: 2,
                        }}>
                          {day.getDate()}
                        </div>
                        {isToday && (
                          <div style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: "var(--primary)",
                            margin: "4px auto 0",
                          }} />
                        )}
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
                          <span style={{
                            position: "absolute",
                            top: -10,
                            right: 8,
                            fontSize: 10,
                            fontFamily: "var(--font-geist-mono)",
                            color: "var(--text-muted-2)",
                            userSelect: "none",
                          }}>
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
          )}

          {/* Legend */}
          {(!isMentee || hasPairing) && (
            <div className="db-legend">
              <span className="swatch">
                <span className="chip-color" style={{ background: "var(--primary)" }} />
                Terkonfirmasi
              </span>
              <span className="swatch">
                <span className="chip-color" style={{ background: "var(--surface-orange)", border: "1px solid var(--surface-orange-border)" }} />
                Pending konfirmasi
              </span>
              <span className="swatch">
                <span className="chip-color" style={{ background: "var(--primary-100)", border: "1px dashed var(--primary-300)" }} />
                Slot tersedia
              </span>
              <span className="spacer" />
              {isMentor && (
                <span style={{ color: "var(--text-muted-2)", fontSize: 12 }}>
                  Klik area kosong untuk tambah slot baru
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Side rail ────────────────────────────────────────────── */}
        <aside className="jadwal-side">
          {isMentor && (
            <>
              <div className="jadwal-side-card">
                <h3>Aturan ketersediaan rutin</h3>
                <div className="desc">
                  Jam mingguan yang otomatis aktif. Atur sekali, slot otomatis muncul tiap minggu.
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted-3)", padding: "8px 0", lineHeight: 1.5 }}>
                  Belum ada aturan rutin. Saat ini setiap slot dibuat manual lewat kalender.
                </div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontFamily: "var(--font-poppins)",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "var(--text-muted-2)",
                  }}
                  title="Fitur akan tersedia segera"
                >
                  + Tambah aturan (segera)
                </span>
              </div>

              <div className="jadwal-side-card">
                <h3>Tautan booking</h3>
                <div className="desc">
                  Bagikan ke mentee — mereka pilih slot sendiri. (segera tersedia)
                </div>
                <div className="booking-link">
                  <span>satutuju.id/book/{user.name?.toLowerCase().replace(/\s+/g, "-") || "mentor"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const link = `satutuju.id/book/${user.name?.toLowerCase().replace(/\s+/g, "-") || "mentor"}`;
                      navigator.clipboard?.writeText(link).catch(() => {});
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Salin
                  </button>
                </div>
              </div>
            </>
          )}

          {isMentee && hasPairing && (
            <div className="jadwal-side-card">
              <h3>Cara request sesi</h3>
              <div className="desc">
                Klik slot yang tersedia (warna biru pucat dengan border putus-putus). Kamu bisa pilih durasi 60 atau 90 menit di pop-up booking.
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="jadwal-side-card">
              <h3>Mode admin</h3>
              <div className="desc">
                Pantau semua mentor — filter dropdown di atas membatasi tampilan ke mentor tertentu. Klik slot mana saja untuk lihat detailnya.
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Overlays (unchanged from previous implementation) ──────── */}

      {mode.type === "creating" && (
        <InlineCreateCard
          date={mode.date}
          startTime={mode.startTime}
          endTime={mode.endTime}
          anchorX={mode.anchorX}
          anchorY={mode.anchorY}
          existingSlots={weekSlots.filter((s) => s.date === mode.date)}
          onClose={() => dispatch({ type: "DISMISS" })}
          onSave={handleSaveNew}
          onUpdateTime={handleUpdateCreateTime}
        />
      )}

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
            const slot = mode.slot;
            dispatch({
              type: "START_BOOKING", slot,
              ghostStart: slot.startTime,
              ghostEnd: minsToTime(Math.min(toMins(slot.startTime) + 90, toMins(slot.endTime))),
            });
          }}
          onAccept={(id) => handleBookingAction(mode.slot.id, id, "accept")}
          onReject={(id, reason) => handleBookingAction(mode.slot.id, id, "reject", reason)}
          onDismissRejection={(id) => handleDismissRejection(mode.slot.id, id)}
        />
      )}

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

      <BookingModal
        open={mode.type === "booking"}
        slot={mode.type === "booking" ? mode.slot : null}
        sessions={sessions}
        initialWindow={mode.type === "booking" ? { startTime: mode.ghostStart, endTime: mode.ghostEnd } : undefined}
        onClose={() => dispatch({ type: "DISMISS" })}
        onBook={handleBook}
        onPreviewChange={handlePreviewChange}
      />

      <ConfirmModal
        open={mode.type === "deleting"}
        onClose={() => dispatch({ type: "DISMISS" })}
        onConfirm={handleDelete}
        title="Hapus slot?"
        description={mode.type === "deleting"
          ? `Hapus slot pada ${fmtDate(mode.slot.date)} (${mode.slot.startTime}–${mode.slot.endTime})? Booking pending akan diberi tahu.`
          : ""}
        confirmLabel="Hapus"
        variant="danger"
        loading={false}
      />
    </>
  );
}
