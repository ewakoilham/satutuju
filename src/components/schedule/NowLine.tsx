"use client";

import { useEffect, useState } from "react";
import { HOUR_START, HOUR_H, TOTAL_H } from "./constants";

export default function NowLine() {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const offset = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
      setTop(offset < 0 || offset > TOTAL_H * 60 ? null : (offset / 60) * HOUR_H);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  if (top === null) return null;
  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
      style={{ top }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  );
}
