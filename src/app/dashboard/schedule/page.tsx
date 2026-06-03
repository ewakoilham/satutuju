"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
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
  EditSlotModal,
  BookingModal,
  SlotPopover,
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

  // Calendar view: Hari (day) / Minggu (week) / Bulan (month) / Agenda (list).
  const [view, setView] = useState<"hari" | "minggu" | "bulan" | "agenda">("minggu");
  // Selected day for the Hari view (null = today / first day of week).
  const [dayDate, setDayDate] = useState<string | null>(null);
  // "Slot baru" side-panel fields (mentor, while creating a slot).
  const [sbNotes, setSbNotes] = useState("");
  const [sbRecur, setSbRecur] = useState(false);
  const [sbSaving, setSbSaving] = useState(false);
  const [sbErr, setSbErr] = useState<string | null>(null);

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
  const drag = useDragToCreate(user?.role, state.mode, weekSlots, dispatch);

  // Active day for the Hari view.
  const activeDay = dayDate ?? today;

  // ── API actions ─────────────────────────────────────────────────────────

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
    if (drag.consumeSkipNextClick()) return;
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

  const handlePreviewChange = useCallback((startTime: string, endTime: string) => {
    dispatch({ type: "UPDATE_GHOST", startTime, endTime });
  }, [dispatch]);

  // ── "Slot baru" panel state ─────────────────────────────────────────────
  const creatingKey = mode.type === "creating" ? `${mode.date}|${mode.startTime}|${mode.endTime}` : "";
  useEffect(() => {
    if (creatingKey) { setSbNotes(""); setSbRecur(false); }
  }, [creatingKey]);

  // ── View-render helpers ─────────────────────────────────────────────────
  const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dur = (s: Slot) => toMins(s.endTime) - toMins(s.startTime);
  function slotKind(s: Slot): "booked" | "pending" | "available" {
    const bs = s.bookings || [];
    if (bs.some((b) => b.status === "accepted")) return "booked";
    if (bs.some((b) => b.status === "pending")) return "pending";
    return "available";
  }
  function slotLabel(s: Slot): { name: string; sub: string } {
    const b = (s.bookings || []).find((x) => x.status === "accepted") ?? (s.bookings || []).find((x) => x.status === "pending");
    if (b) {
      const who = b.mentee?.name || "Mentee";
      const name = b.session ? `${who} · Sesi ${b.session.sessionNum}` : who;
      return { name, sub: b.session?.topic || s.notes || `${dur(s)} menit` };
    }
    return { name: "Tersedia", sub: s.notes || `${dur(s)} menit` };
  }
  const parseDay = (ds: string) => new Date(ds + "T00:00:00");

  async function handleSaveSlotBaru() {
    if (mode.type !== "creating") return;
    const { date, startTime, endTime } = mode;
    setSbSaving(true);
    setSbErr(null);
    try {
      if (sbRecur) {
        // Recurring → create an availability rule (8 weeks of slots).
        const res = await fetch("/api/availability", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayOfWeek: parseDay(date).getDay(), startTime, endTime,
            recurMode: "fixed", weeksAhead: 8, notes: sbNotes.trim() || null,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Gagal membuat aturan");
      } else {
        const res = await fetch("/api/schedule", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, startTime, endTime, notes: sbNotes.trim() }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan slot");
      }
      dispatch({ type: "DISMISS" });
      await refresh();
    } catch (e) {
      setSbErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSbSaving(false);
    }
  }

  function setCreateDuration(mins: number) {
    if (mode.type !== "creating") return;
    dispatch({ type: "UPDATE_CREATE_TIME", startTime: mode.startTime, endTime: minsToTime(toMins(mode.startTime) + mins) });
  }

  function renderDayView() {
    const d = parseDay(activeDay);
    const daySlots = slots
      .filter((s) => s.date === activeDay)
      .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
    const sesiCount = daySlots.filter((s) => slotKind(s) !== "available").length;
    const openCount = daySlots.filter((s) => slotKind(s) === "available").length;
    return (
      <div className="dayv">
        <div className="dayv-head">
          <div className="dayv-date">
            <div className="dayv-dnum">{d.getDate()}</div>
            <div className="dayv-dname">
              <b>{ID_DAYS[d.getDay()]}</b>
              <span>{ID_MONTHS[d.getMonth()]} {d.getFullYear()}{activeDay === today ? " · hari ini" : ""}</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <b style={{ color: "var(--primary-900)" }}>{sesiCount} sesi</b> ·{" "}
            <b style={{ color: "var(--primary-900)" }}>{openCount} slot kosong</b>
          </div>
        </div>
        <div className="dayv-timeline">
          {Array.from({ length: TOTAL_H }, (_, i) => {
            const h = HOUR_START + i;
            const rowSlots = daySlots.filter((s) => Math.floor(toMins(s.startTime) / 60) === h);
            return (
              <div className="dayv-row" key={h}>
                <span className="dayv-hour">{String(h).padStart(2, "0")}:00</span>
                <div className="dayv-cells">
                  {rowSlots.map((s) => {
                    const k = slotKind(s);
                    const { name, sub } = slotLabel(s);
                    return (
                      <div key={s.id} className={`dayv-evt ${k}`} onClick={(e) => handleSlotClick(e, s)}>
                        <div className="dayv-evt-head"><b>{name}</b><span>{dur(s)} mnt</span></div>
                        <div className="dayv-evt-sub">{sub} · {s.startTime} → {s.endTime}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {daySlots.length === 0 && <div className="dayv-empty">Tidak ada slot pada hari ini.</div>}
        </div>
      </div>
    );
  }

  function renderMonthView() {
    const ref = parseDay(activeDay);
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    const month = first.getMonth();
    const byDate = new Map<string, Slot[]>();
    for (const s of slots) {
      const a = byDate.get(s.date) || [];
      a.push(s);
      byDate.set(s.date, a);
    }
    return (
      <div className="monv">
        <div className="monv-head">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="monv-grid">
          {Array.from({ length: 42 }, (_, i) => {
            const dt = new Date(gridStart);
            dt.setDate(gridStart.getDate() + i);
            const ds = toDateStr(dt);
            const out = dt.getMonth() !== month;
            const isToday = ds === today;
            const dayS = byDate.get(ds) || [];
            const kinds = new Set(dayS.map(slotKind));
            return (
              <div
                key={i}
                className={`monv-cell${out ? " out" : ""}${isToday ? " today" : ""}`}
                onClick={() => { if (!out) { setDayDate(ds); setView("hari"); } }}
              >
                <span className="monv-num">{dt.getDate()}</span>
                {!out && dayS.length > 0 && (
                  <>
                    <span className="monv-dots">
                      {kinds.has("booked") && <span className="monv-dot booked" />}
                      {kinds.has("pending") && <span className="monv-dot pending" />}
                      {kinds.has("available") && <span className="monv-dot avail" />}
                    </span>
                    <span className="monv-cnt">{dayS.length} slot</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderAgendaView() {
    const upcoming = slots
      .filter((s) => s.date >= today)
      .sort((a, b) => (a.date === b.date ? toMins(a.startTime) - toMins(b.startTime) : a.date.localeCompare(b.date)));
    if (upcoming.length === 0) {
      return <div className="agenda"><div className="agenda-empty">Belum ada slot mendatang.</div></div>;
    }
    const groups: { date: string; items: Slot[] }[] = [];
    for (const s of upcoming) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== s.date) { g = { date: s.date, items: [] }; groups.push(g); }
      g.items.push(s);
    }
    return (
      <div className="agenda">
        {groups.map((g) => {
          const dt = parseDay(g.date);
          const isToday = g.date === today;
          return (
            <div key={g.date}>
              <div className="agenda-day-head">
                <span className="agenda-day-name">{isToday ? "Hari ini" : ID_DAYS[dt.getDay()]}</span>
                <span className="agenda-day-date">{dt.getDate()} {ID_MONTHS[dt.getMonth()]}</span>
                <span className="agenda-day-meta">{g.items.length} slot</span>
              </div>
              {g.items.map((s) => {
                const k = slotKind(s);
                const { name, sub } = slotLabel(s);
                const initials = name.replace(/·.*$/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <div key={s.id} className={`agenda-evt ${k}`} onClick={(e) => handleSlotClick(e, s)}>
                    <div className="agenda-ico" style={k === "available" ? { background: "var(--primary-100)", color: "var(--primary)" } : { background: "var(--primary)", color: "#fff" }}>
                      {k === "available" ? "⏰" : initials}
                    </div>
                    <div className="agenda-evt-info">
                      <div className="agenda-evt-name">{name}</div>
                      <div className="agenda-evt-sub">{sub}</div>
                    </div>
                    <div className="agenda-evt-time">{s.startTime}<span>{dur(s)}m</span></div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

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
          {(["hari", "minggu", "bulan", "agenda"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              className={view === v ? "on" : ""}
              onClick={() => setView(v)}
            >
              {v === "hari" ? "Hari" : v === "minggu" ? "Minggu" : v === "bulan" ? "Bulan" : "Agenda"}
            </button>
          ))}
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
            <>
            {view === "minggu" && (
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
            {view === "hari" && renderDayView()}
            {view === "bulan" && renderMonthView()}
            {view === "agenda" && renderAgendaView()}
            </>
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
              {mode.type === "creating" && (
                <div className="jadwal-side-card slotbaru">
                  <h3>Slot baru</h3>
                  <div className="when-pick">
                    {ID_DAYS[parseDay(mode.date).getDay()]} {parseDay(mode.date).getDate()} {ID_MONTHS[parseDay(mode.date).getMonth()]} · {mode.startTime} — {mode.endTime}
                  </div>

                  <div className="sb-field">
                    <label className="sb-label">Durasi</label>
                    <div className="duration-row">
                      {[60, 90, 120].map((d) => {
                        const cur = toMins(mode.endTime) - toMins(mode.startTime);
                        return (
                          <span
                            key={d}
                            className={`pill${cur === d ? " on" : ""}`}
                            onClick={() => setCreateDuration(d)}
                          >
                            {d} mnt
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sb-field">
                    <label className="sb-label">Catatan (opsional)</label>
                    <input
                      className="sb-input"
                      value={sbNotes}
                      onChange={(e) => setSbNotes(e.target.value)}
                      placeholder="contoh: hanya untuk sesi review essay"
                    />
                  </div>

                  <div className="recurring-row" onClick={() => setSbRecur((v) => !v)}>
                    <div className={`toggle${sbRecur ? " on" : ""}`} />
                    <span>
                      Ulangi tiap <b style={{ color: "var(--primary-900)" }}>{ID_DAYS[parseDay(mode.date).getDay()]}</b> selama{" "}
                      <b style={{ color: "var(--primary-900)" }}>8 minggu</b>
                    </span>
                  </div>

                  {sbErr && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{sbErr}</p>}

                  <div className="sb-actions">
                    <button type="button" className="btn-primary text-sm py-2" disabled={sbSaving} onClick={handleSaveSlotBaru}>
                      {sbSaving ? "Menyimpan…" : "Simpan slot"}
                    </button>
                    <button type="button" className="btn-ghost text-sm py-2" onClick={() => dispatch({ type: "DISMISS" })}>
                      Batal
                    </button>
                  </div>
                </div>
              )}

              <RecurringRulesCard onChanged={refresh} />

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

      {/* ── Overlays ───────────────────────────────────────────────── */}
      {/* Slot creation is handled by the "Slot baru" side panel (mentor). */}

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
