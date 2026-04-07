"use client";

import type { MentorOption } from "./types";

interface LegendProps {
  role: string;
  mentors: MentorOption[];
  mentorColorMap: Map<string, string>;
}

export default function Legend({ role, mentors, mentorColorMap }: LegendProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-muted px-0.5">
      {role === "mentor" && (
        <>
          <LegendItem color="bg-blue-600" label="Available" />
          <LegendItem color="bg-amber-400" label="Pending request" />
          <LegendItem color="bg-emerald-500" label="Booked" />
          <span className="text-text-muted-2 ml-1">&middot; Click any empty area to add a slot</span>
        </>
      )}
      {role === "mentee" && (
        <>
          <LegendItem color="bg-blue-600" label="Available" />
          <LegendItem color="bg-amber-400" label="Your request pending" />
          <LegendItem color="bg-emerald-500" label="Accepted" />
          <LegendItem color="bg-red-400" label="Request rejected" />
        </>
      )}
      {role === "admin" && (
        <>
          {/* Status dots */}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-blue-500" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-amber-400" />
            Pending request
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-emerald-500" />
            Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-red-400" />
            Rejected
          </span>
          {/* Mentor palette */}
          {mentors.length > 0 && (
            <>
              <span className="text-text-muted-2">&middot;</span>
              {mentors.map(m => {
                const color = mentorColorMap.get(m.id);
                if (!color) return null;
                return (
                  <span key={m.id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded inline-block flex-shrink-0"
                      style={{ backgroundColor: color }} />
                    {m.name}
                  </span>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded inline-block ${color}`} />
      {label}
    </span>
  );
}
