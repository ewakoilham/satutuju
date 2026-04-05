"use client";

import { useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import { calcPopoverPos, fmtDate, slotColorClass } from "./helpers";
import type { Slot } from "./types";

interface SlotPopoverProps {
  slot: Slot;
  role: string;
  x: number;
  y: number;
  /** Admin: hex color for the mentor */
  mentorColor?: string;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBook?: () => void;
  onAccept?: (bookingId: string) => void;
  onReject?: (bookingId: string) => void;
}

export default function SlotPopover({
  slot, role, x, y, mentorColor,
  onClose, onEdit, onDelete, onBook, onAccept, onReject,
}: SlotPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  const { left, top } = calcPopoverPos(x, y, 272, 380);
  const pending = (slot.bookings || []).filter(b => b.status === "pending");
  const myBooking = slot.myBooking;

  // Header color
  const headerBgClass = mentorColor ? "" : slotColorClass(slot, role).split(" ")[0]; // first class only (no hover)
  const headerBgStyle = mentorColor ? { backgroundColor: mentorColor } : {};

  // Dark text on amber backgrounds
  const isAmber = headerBgClass.includes("amber");
  const headerTextColor = isAmber ? "text-gray-900" : "text-white";

  // Display time: mentee with booking shows requested window
  const headerTime = (() => {
    if (role === "mentee" && myBooking?.requestedStart && myBooking?.requestedEnd) {
      return `${myBooking.requestedStart} \u2013 ${myBooking.requestedEnd}`;
    }
    return `${slot.startTime} \u2013 ${slot.endTime}`;
  })();

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
      style={{ left, top, width: 272 }}
    >
      {/* Colored header */}
      <div className={`${headerBgClass} ${headerTextColor} px-4 py-3`} style={headerBgStyle}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{headerTime}</p>
            <p className="text-xs opacity-75 mt-0.5">{fmtDate(slot.date)}</p>
          </div>
          <button onClick={onClose}
            className="opacity-70 hover:opacity-100 transition flex-shrink-0 mt-0.5">
            <Icon name="x" size={14} />
          </button>
        </div>
        {slot.notes && <p className="text-xs opacity-70 mt-1.5 leading-snug">{slot.notes}</p>}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Mentor: edit / delete + booking requests */}
        {role === "mentor" && (
          <div className="flex gap-1.5">
            <button onClick={() => onEdit?.()}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs btn-ghost px-2 py-1.5 rounded-lg">
              <Icon name="edit" size={13} /> Edit
            </button>
            <button onClick={() => onDelete?.()}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-red-500 border border-red-100 hover:bg-red-50 transition">
              <Icon name="trash" size={13} /> Delete
            </button>
          </div>
        )}

        {role === "mentor" && pending.length > 0 && (
          <div className="border-t border-gray-100 pt-2.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Requests ({pending.length})
            </p>
            <div className="space-y-2">
              {pending.map(b => (
                <div key={b.id} className="bg-gray-50 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={b.mentee?.name || "?"} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{b.mentee?.name}</p>
                      {b.requestedStart && b.requestedEnd && (
                        <p className="text-[11px] text-blue-600 font-medium truncate">
                          {b.requestedStart}&ndash;{b.requestedEnd}
                        </p>
                      )}
                      {b.message && (
                        <p className="text-[11px] text-gray-400 italic truncate">
                          &ldquo;{b.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => onAccept?.(b.id)}
                      className="btn-primary text-xs px-2 py-1 flex-1">Accept</button>
                    <button onClick={() => onReject?.(b.id)}
                      className="text-xs px-2 py-1 flex-1 rounded border border-gray-200 hover:bg-gray-100 transition text-gray-500">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mentee: request / status */}
        {role === "mentee" && (
          <>
            {!myBooking && !slot.bookings?.some(b => b.status === "accepted") && (
              <button onClick={() => onBook?.()} className="btn-primary w-full text-sm py-2">
                Request this slot
              </button>
            )}
            {myBooking && (
              <div className="flex items-center gap-2 py-0.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  myBooking.status === "accepted" ? "bg-emerald-500" :
                  myBooking.status === "rejected" ? "bg-red-400" : "bg-amber-400"
                }`} />
                <p className="text-xs text-gray-700 font-medium">
                  {myBooking.status === "accepted" ? "Booking accepted \u2713" :
                   myBooking.status === "rejected" ? "Request rejected" : "Request pending\u2026"}
                </p>
              </div>
            )}
            {!myBooking && slot.bookings?.some(b => b.status === "accepted") && (
              <p className="text-xs text-gray-400 py-0.5">This slot is already booked.</p>
            )}
          </>
        )}

        {/* Admin: mentor info */}
        {role === "admin" && slot.mentor && (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar name={slot.mentor.name} size="sm" />
            <div>
              <p className="text-xs font-medium">{slot.mentor.name}</p>
              <p className="text-xs text-gray-400">{slot.mentor.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
