import { useReducer } from "react";
import { getWeekStart, addDays } from "./helpers";
import type { ScheduleState, ScheduleAction } from "./types";

function createInitialState(): ScheduleState {
  return {
    slots: [],
    sessions: [],
    hasPairing: true,
    loading: true,
    weekStart: getWeekStart(new Date()),
    mentorFilter: "",
    mentors: [],
    mode: { type: "idle" },
  };
}

function reducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  switch (action.type) {
    case "SET_SLOTS":
      return { ...state, slots: action.slots };
    case "SET_SESSIONS":
      return { ...state, sessions: action.sessions };
    case "SET_HAS_PAIRING":
      return { ...state, hasPairing: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_WEEK":
      return { ...state, weekStart: getWeekStart(action.date), mode: { type: "idle" } };
    case "PREV_WEEK":
      return { ...state, weekStart: addDays(state.weekStart, -7), mode: { type: "idle" } };
    case "NEXT_WEEK":
      return { ...state, weekStart: addDays(state.weekStart, 7), mode: { type: "idle" } };
    case "TODAY":
      return { ...state, weekStart: getWeekStart(new Date()), mode: { type: "idle" } };
    case "SET_MENTOR_FILTER":
      return { ...state, mentorFilter: action.value };
    case "SET_MENTORS":
      return { ...state, mentors: action.mentors };

    // ── Drag-to-create ─────────────────────────────────────────────
    case "START_DRAG":
      return {
        ...state,
        mode: { type: "dragging", date: action.date, startTime: action.startTime, endTime: action.endTime },
      };
    case "UPDATE_DRAG":
      if (state.mode.type !== "dragging") return state;
      return {
        ...state,
        mode: { ...state.mode, endTime: action.endTime },
      };
    case "FINISH_DRAG":
      if (state.mode.type !== "dragging") return state;
      return {
        ...state,
        mode: {
          type: "creating",
          date: state.mode.date,
          startTime: state.mode.startTime,
          endTime: state.mode.endTime,
          anchorX: action.anchorX,
          anchorY: action.anchorY,
        },
      };

    // ── Mode transitions ──────────────────────────────────────────────
    case "START_CREATING":
      return {
        ...state,
        mode: {
          type: "creating",
          date: action.date,
          startTime: action.startTime,
          endTime: action.endTime,
          anchorX: action.anchorX,
          anchorY: action.anchorY,
        },
      };
    case "UPDATE_CREATE_TIME":
      if (state.mode.type !== "creating") return state;
      return {
        ...state,
        mode: { ...state.mode, startTime: action.startTime, endTime: action.endTime },
      };
    case "VIEW_SLOT":
      return {
        ...state,
        mode: { type: "viewing", slot: action.slot, anchorX: action.anchorX, anchorY: action.anchorY },
      };
    case "START_EDITING":
      return { ...state, mode: { type: "editing", slot: action.slot } };
    case "START_BOOKING":
      return {
        ...state,
        mode: { type: "booking", slot: action.slot, ghostStart: action.ghostStart, ghostEnd: action.ghostEnd },
      };
    case "UPDATE_GHOST":
      if (state.mode.type !== "booking") return state;
      return {
        ...state,
        mode: { ...state.mode, ghostStart: action.startTime, ghostEnd: action.endTime },
      };
    case "START_DELETING":
      return { ...state, mode: { type: "deleting", slot: action.slot } };
    case "DISMISS":
      return { ...state, mode: { type: "idle" } };

    default:
      return state;
  }
}

export function useScheduleReducer() {
  return useReducer(reducer, undefined, createInitialState);
}
