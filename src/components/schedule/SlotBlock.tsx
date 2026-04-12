"use client";

import Icon from "@/components/ui/Icon";
import { slotPos, slotColorClass, slotTextClass } from "./helpers";
import type { Slot } from "./types";

interface SlotBlockProps {
  slot: Slot;
  role: string;
  col: number;
  totalCols: number;
  isSelected: boolean;
  /** Admin: hex mentor color override */
  mentorColor?: string;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * A single calendar block — one slot, one solid color.
 * No segment splitting. Color determined by booking status.
 */
export default function SlotBlock({
  slot, role, col, totalCols, isSelected, mentorColor, onClick,
}: SlotBlockProps) {
  const { top, height } = slotPos(slot.startTime, slot.endTime);
  const pct = 100 / totalCols;

  const colorCls = mentorColor ? "" : slotColorClass(slot, role);
  const textCls  = mentorColor ? "text-white" : slotTextClass(slot, role);

  const pendingCount = role === "mentor"
    ? (slot.bookings || []).filter(b => b.status === "pending").length
    : 0;

  // Admin status dot: summarise the slot's booking state
  const adminStatusDot = role === "admin" ? (() => {
    const bookings = slot.bookings || [];
    if (bookings.some(b => b.status === "accepted"))
      return { color: "#22c55e", title: "Booked" };
    if (bookings.some(b => b.status === "pending"))
      return { color: "#f59e0b", title: "Pending request" };
    if (bookings.length > 0 && bookings.every(b => b.status === "rejected"))
      return { color: "#ef4444", title: "Rejected" };
    return { color: "#3b82f6", title: "Available" };
  })() : null;

  // Display time: if mentee has a booking with requested window, show that
  const displayTime = (() => {
    if (role === "mentee" && slot.myBooking?.requestedStart && slot.myBooking?.requestedEnd) {
      return `${slot.myBooking.requestedStart}\u2013${slot.myBooking.requestedEnd}`;
    }
    return `${slot.startTime}\u2013${slot.endTime}`;
  })();

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onClick={onClick}
      className={`absolute rounded-md overflow-hidden transition-all select-none cursor-pointer
        ${colorCls} ${textCls}
        ${isSelected ? "ring-2 ring-white/50 brightness-110" : "active:brightness-95"}`}
      style={{
        top,
        height,
        left: `calc(${col * pct}% + 2px)`,
        width: `calc(${pct}% - 4px)`,
        ...(mentorColor ? { backgroundColor: mentorColor } : {}),
      }}
    >
      <div className="relative z-10 px-2 py-1">
        <p className="text-[11px] font-semibold truncate leading-tight">
          {displayTime}
        </p>
        {height > 38 && slot.notes && (
          <p className="text-[10px] opacity-70 truncate mt-0.5">{slot.notes}</p>
        )}
        {role === "admin" && slot.mentor && (
          <p className="text-[10px] opacity-80 truncate mt-0.5">{slot.mentor.name}</p>
        )}
        {pendingCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-white/90 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-[9px] font-bold text-amber-600">{pendingCount}</span>
          </span>
        )}
        {role === "mentee" && slot.myBooking && (
          <span className="absolute top-1 right-1">
            {slot.myBooking.status === "accepted" && <Icon name="check" size={12} />}
            {slot.myBooking.status === "pending" && <Icon name="clock" size={12} />}
          </span>
        )}
        {adminStatusDot && (
          <span
            className="absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white/80 shadow"
            style={{ backgroundColor: adminStatusDot.color }}
            title={adminStatusDot.title}
          />
        )}
      </div>
    </div>
  );
}
