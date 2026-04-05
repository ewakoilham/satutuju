// ── Calendar grid constants ───────────────────────────────────────────────

export const HOUR_START = 7;      // 7 AM
export const HOUR_END   = 22;     // 10 PM
export const HOUR_H     = 60;     // px per hour
export const TOTAL_H    = HOUR_END - HOUR_START; // 15 hours visible
export const SNAP_MINS  = 30;     // grid snap interval

export const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Distinct palette for admin multi-mentor view (stable by sorted mentorId)
export const MENTOR_PALETTE = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f59e0b", // amber
  "#6366f1", // indigo
] as const;
