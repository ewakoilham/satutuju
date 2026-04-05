import { useEffect, useCallback } from "react";
import type { ScheduleAction } from "./types";

/**
 * Fetches schedule data from the API, dispatching results into the reducer.
 * Returns a stable `refresh` function for use after mutations.
 */
export function useScheduleData(
  role: string | undefined,
  mentorFilter: string,
  dispatch: React.Dispatch<ScheduleAction>
) {
  const refresh = useCallback(async () => {
    if (!role) return;
    dispatch({ type: "SET_LOADING", value: true });

    const url = role === "admin" && mentorFilter
      ? `/api/schedule?mentorId=${mentorFilter}`
      : "/api/schedule";

    try {
      const res  = await fetch(url);
      const data = await res.json();
      dispatch({ type: "SET_SLOTS", slots: data.slots || [] });
      if (data.hasPairing !== undefined) {
        dispatch({ type: "SET_HAS_PAIRING", value: data.hasPairing });
      }
      if (data.sessions) {
        dispatch({ type: "SET_SESSIONS", sessions: data.sessions });
      }
    } catch {
      // Silently fail — loading state will clear
    }

    dispatch({ type: "SET_LOADING", value: false });
  }, [role, mentorFilter, dispatch]);

  // Fetch on mount and when dependencies change
  useEffect(() => { refresh(); }, [refresh]);

  // Fetch mentor list for admin filter
  useEffect(() => {
    if (role === "admin") {
      fetch("/api/users?role=mentor")
        .then(r => r.json())
        .then(d => dispatch({ type: "SET_MENTORS", mentors: d.users || [] }))
        .catch(() => {});
    }
  }, [role, dispatch]);

  return refresh;
}
