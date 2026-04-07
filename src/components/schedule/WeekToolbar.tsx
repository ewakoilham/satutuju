"use client";

import Icon from "@/components/ui/Icon";
import type { ScheduleAction } from "./types";

interface WeekToolbarProps {
  weekStart: Date;
  dispatch: React.Dispatch<ScheduleAction>;
}

export default function WeekToolbar({ weekStart, dispatch }: WeekToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => dispatch({ type: "TODAY" })}
        className="btn-ghost text-sm px-3 py-1.5 font-medium"
      >
        Today
      </button>
      <div className="flex">
        <button
          onClick={() => dispatch({ type: "PREV_WEEK" })}
          className="p-2 rounded-lg hover:bg-surface-elevated transition text-text-muted"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <button
          onClick={() => dispatch({ type: "NEXT_WEEK" })}
          className="p-2 rounded-lg hover:bg-surface-elevated transition text-text-muted"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <span className="text-base font-semibold text-foreground">
        {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </span>
    </div>
  );
}
