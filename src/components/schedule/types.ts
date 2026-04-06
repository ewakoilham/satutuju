// ── Schedule feature types ────────────────────────────────────────────────

export interface Booking {
  id: string;
  menteeId: string;
  message: string | null;
  sessionId?: string | null;
  requestedStart?: string | null;
  requestedEnd?: string | null;
  status: "pending" | "accepted" | "rejected";
  googleMeetLink?: string | null;
  createdAt: string;
  mentee?: { name: string; email: string };
  session?: { id: string; sessionNum: number; topic: string; phase: string } | null;
}

export interface Slot {
  id: string;
  mentorId?: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  notes: string | null;
  status: string;
  bookings?: Booking[];
  myBooking?: Booking | null;
  mentor?: { name: string; email: string };
}

export interface Session {
  id: string;
  sessionNum: number;
  phase: string;
  topic: string;
  status: string;
  scheduledAt?: string | null;
}

export interface MentorOption {
  id: string;
  name: string;
  email: string;
}

// ── Reducer state ─────────────────────────────────────────────────────────

export type Mode =
  | { type: "idle" }
  | { type: "creating"; date: string; startTime: string; endTime: string; anchorX: number; anchorY: number }
  | { type: "viewing"; slot: Slot; anchorX: number; anchorY: number }
  | { type: "editing"; slot: Slot }
  | { type: "booking"; slot: Slot; ghostStart: string; ghostEnd: string }
  | { type: "deleting"; slot: Slot };

export interface ScheduleState {
  slots: Slot[];
  sessions: Session[];
  hasPairing: boolean;
  loading: boolean;
  weekStart: Date;
  mentorFilter: string;
  mentors: MentorOption[];
  mode: Mode;
}

// ── Reducer actions ───────────────────────────────────────────────────────

export type ScheduleAction =
  | { type: "SET_SLOTS"; slots: Slot[] }
  | { type: "SET_SESSIONS"; sessions: Session[] }
  | { type: "SET_HAS_PAIRING"; value: boolean }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_WEEK"; date: Date }
  | { type: "PREV_WEEK" }
  | { type: "NEXT_WEEK" }
  | { type: "TODAY" }
  | { type: "SET_MENTOR_FILTER"; value: string }
  | { type: "SET_MENTORS"; mentors: MentorOption[] }
  | { type: "START_CREATING"; date: string; startTime: string; endTime: string; anchorX: number; anchorY: number }
  | { type: "UPDATE_CREATE_TIME"; startTime: string; endTime: string }
  | { type: "VIEW_SLOT"; slot: Slot; anchorX: number; anchorY: number }
  | { type: "START_EDITING"; slot: Slot }
  | { type: "START_BOOKING"; slot: Slot; ghostStart: string; ghostEnd: string }
  | { type: "UPDATE_GHOST"; startTime: string; endTime: string }
  | { type: "START_DELETING"; slot: Slot }
  | { type: "DISMISS" };
