"use client";

import { useRef, useEffect, useState } from "react";
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
  onReject?: (bookingId: string, reason: string) => void;
  /** Mentee: dismiss a rejected booking so they can rebook */
  onDismissRejection?: (bookingId: string) => void;
}

export default function SlotPopover({
  slot, role, x, y, mentorColor,
  onClose, onEdit, onDelete, onBook, onAccept, onReject, onDismissRejection,
}: SlotPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Track which booking is showing the rejection reason form: bookingId | null
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
  const headerBgClass = mentorColor ? "" : slotColorClass(slot, role).split(" ")[0];
  const headerBgStyle = mentorColor ? { backgroundColor: mentorColor } : {};

  const isAmber = headerBgClass.includes("amber");
  const headerTextColor = isAmber ? "text-gray-900" : "text-white";

  const headerTime = (() => {
    if (role === "mentee" && myBooking?.requestedStart && myBooking?.requestedEnd) {
      return `${myBooking.requestedStart} \u2013 ${myBooking.requestedEnd}`;
    }
    return `${slot.startTime} \u2013 ${slot.endTime}`;
  })();

  function startRejecting(bookingId: string) {
    setRejectingId(bookingId);
    setRejectReason("");
  }

  function cancelRejecting() {
    setRejectingId(null);
    setRejectReason("");
  }

  function confirmReject() {
    if (!rejectingId || !rejectReason.trim()) return;
    onReject?.(rejectingId, rejectReason.trim());
    setRejectingId(null);
    setRejectReason("");
  }

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
        {/* Mentor: context-aware actions */}
        {role === "mentor" && (() => {
          const acceptedBooking = (slot.bookings || []).find(b => b.status === "accepted");
          const hasPending = pending.length > 0;

          // ── State 1: Accepted booking exists ─────────────────────────
          if (acceptedBooking) {
            return (
              <>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-emerald-700">Session confirmed</p>
                  <p className="text-[11px] text-emerald-600">
                    {acceptedBooking.mentee?.name ?? "Mentee"} &middot;{" "}
                    {acceptedBooking.requestedStart && acceptedBooking.requestedEnd
                      ? `${acceptedBooking.requestedStart}\u2013${acceptedBooking.requestedEnd}`
                      : `${slot.startTime}\u2013${slot.endTime}`}
                  </p>
                  {acceptedBooking.session && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Session {acceptedBooking.session.sessionNum}: {acceptedBooking.session.topic}
                    </p>
                  )}
                </div>
                {acceptedBooking.googleMeetLink && (
                  <a href={acceptedBooking.googleMeetLink} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                    <Icon name="video" size={14} />
                    Join Google Meet
                  </a>
                )}

                {/* Cancel session — show reason form inline */}
                {rejectingId === acceptedBooking.id ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Reason for cancellation <span className="text-red-500">*</span></p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="e.g. Schedule conflict, need to reschedule…"
                      rows={3}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={cancelRejecting}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                        Back
                      </button>
                      <button
                        onClick={confirmReject}
                        disabled={!rejectReason.trim()}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                        Confirm Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => startRejecting(acceptedBooking.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-2 rounded-lg text-red-500 border border-red-100 hover:bg-red-50 transition"
                    >
                      <Icon name="x" size={13} /> Cancel session
                    </button>
                    <p className="text-[10px] text-gray-400 text-center leading-snug px-1">
                      Cancelling will notify the mentee and make this slot available again.
                    </p>
                  </>
                )}
              </>
            );
          }

          // ── State 2: Pending requests — no edit or delete ─────────────
          if (hasPending) {
            return (
              <>
                <div className="flex gap-1.5">
                  <button disabled
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-gray-300 border border-gray-100 cursor-not-allowed"
                    title="Reject all requests before editing">
                    <Icon name="edit" size={13} /> Edit
                  </button>
                  <button disabled
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-gray-300 border border-gray-100 cursor-not-allowed"
                    title="Reject all requests before deleting">
                    <Icon name="trash" size={13} /> Delete
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 flex items-start gap-1 px-0.5">
                  <span className="mt-px flex-shrink-0">⚠</span>
                  Reject all requests before editing or deleting this slot.
                </p>
              </>
            );
          }

          // ── State 3: Clean slot ───────────────────────────────────────
          return (
            <>
              <div className="flex items-center gap-2 py-0.5 px-0.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">Available time slot for mentoring</p>
              </div>
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
            </>
          );
        })()}

        {/* Mentor: pending requests list */}
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
                      {b.session && (
                        <p className="text-[11px] text-gray-600 font-medium truncate">
                          Session {b.session.sessionNum}: {b.session.topic}
                        </p>
                      )}
                      {b.message && (
                        <p className="text-[11px] text-gray-400 italic truncate">
                          &ldquo;{b.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rejection reason form for this booking */}
                  {rejectingId === b.id ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">Reason for rejection <span className="text-red-500">*</span></p>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="e.g. Already have another session booked…"
                        rows={3}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button onClick={cancelRejecting}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                          Back
                        </button>
                        <button
                          onClick={confirmReject}
                          disabled={!rejectReason.trim()}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button onClick={() => onAccept?.(b.id)}
                        className="btn-primary text-xs px-2 py-1 flex-1">Accept</button>
                      <button onClick={() => startRejecting(b.id)}
                        className="text-xs px-2 py-1 flex-1 rounded border border-gray-200 hover:bg-gray-100 transition text-gray-500">
                        Reject
                      </button>
                    </div>
                  )}
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
            {myBooking && myBooking.status !== "rejected" && (
              <div className={`rounded-lg px-3 py-2.5 space-y-1 ${
                myBooking.status === "accepted"
                  ? "bg-emerald-50 border border-emerald-100"
                  : "bg-amber-50 border border-amber-100"
              }`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    myBooking.status === "accepted" ? "bg-emerald-500" : "bg-amber-400"
                  }`} />
                  <p className={`text-xs font-semibold ${
                    myBooking.status === "accepted" ? "text-emerald-700" : "text-amber-700"
                  }`}>
                    {myBooking.status === "accepted" ? "Booking accepted \u2713" : "Request pending\u2026"}
                  </p>
                </div>
                {myBooking.session && (
                  <p className={`text-[11px] font-medium pl-3.5 ${
                    myBooking.status === "accepted" ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    Session {myBooking.session.sessionNum}: {myBooking.session.topic}
                  </p>
                )}
              </div>
            )}
            {myBooking && myBooking.status === "accepted" && myBooking.googleMeetLink && (
              <a href={myBooking.googleMeetLink} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                <Icon name="video" size={14} />
                Join Google Meet
              </a>
            )}
            {myBooking && myBooking.status === "rejected" && (
              <div className="space-y-2.5">
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-red-600">Request rejected</p>
                  {myBooking.session && (
                    <p className="text-[11px] text-red-500 font-medium">
                      Session {myBooking.session.sessionNum}: {myBooking.session.topic}
                    </p>
                  )}
                  {myBooking.rejectionReason ? (
                    <p className="text-[11px] text-red-500 leading-snug">
                      <span className="font-medium">Reason: </span>{myBooking.rejectionReason}
                    </p>
                  ) : (
                    <p className="text-[11px] text-red-400 leading-snug">
                      Your mentor declined this request. You can dismiss and try booking again.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDismissRejection?.(myBooking.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs btn-primary py-2"
                >
                  Dismiss &amp; rebook
                </button>
              </div>
            )}
            {!myBooking && slot.bookings?.some(b => b.status === "accepted") && (
              <p className="text-xs text-gray-400 py-0.5">This slot is already booked.</p>
            )}
          </>
        )}

        {/* Admin: mentor info + booking status */}
        {role === "admin" && (
          <>
            {slot.mentor && (
              <div className="flex items-center gap-2.5 py-0.5">
                <Avatar name={slot.mentor.name} size="sm" />
                <div>
                  <p className="text-xs font-medium">{slot.mentor.name}</p>
                  <p className="text-xs text-gray-400">{slot.mentor.email}</p>
                </div>
              </div>
            )}

            {/* Accepted booking */}
            {(() => {
              const accepted = (slot.bookings || []).find(b => b.status === "accepted");
              if (!accepted) return null;
              return (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 space-y-0.5">
                  <p className="text-xs font-semibold text-emerald-700">Session confirmed</p>
                  <p className="text-[11px] text-emerald-600">
                    {accepted.mentee?.name ?? "Mentee"}
                    {accepted.requestedStart && accepted.requestedEnd && (
                      <> &middot; {accepted.requestedStart}&ndash;{accepted.requestedEnd}</>
                    )}
                  </p>
                  {accepted.session && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Session {accepted.session.sessionNum}: {accepted.session.topic}
                    </p>
                  )}
                  {accepted.googleMeetLink && (
                    <a href={accepted.googleMeetLink} target="_blank" rel="noopener noreferrer"
                      className="mt-1.5 flex items-center justify-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                      <Icon name="video" size={13} />
                      Join Google Meet
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Pending requests */}
            {(() => {
              const pendingList = (slot.bookings || []).filter(b => b.status === "pending");
              if (pendingList.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Pending ({pendingList.length})
                  </p>
                  {pendingList.map(b => (
                    <div key={b.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-0.5">
                      <p className="text-[11px] font-medium text-amber-800">
                        {b.mentee?.name ?? "Mentee"}
                        {b.requestedStart && b.requestedEnd && (
                          <> &middot; {b.requestedStart}&ndash;{b.requestedEnd}</>
                        )}
                      </p>
                      {b.session && (
                        <p className="text-[11px] text-amber-700 font-medium">
                          Session {b.session.sessionNum}: {b.session.topic}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Available */}
            {(slot.bookings || []).length === 0 && (
              <div className="flex items-center gap-2 py-0.5 px-0.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">Available time slot</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
