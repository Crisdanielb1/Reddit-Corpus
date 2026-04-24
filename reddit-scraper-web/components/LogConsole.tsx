"use client";

import { useEffect, useRef } from "react";
import type { LogEvent } from "@/lib/types";

function fmtTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  logs: LogEvent[];
  running: boolean;
}

export function LogConsole({ logs, running }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stickyRef = useRef(true);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickyRef.current = distanceFromBottom < 30;
  }

  useEffect(() => {
    if (!stickyRef.current) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="relative">
      <div className="console" ref={ref} onScroll={onScroll}>
        {logs.length === 0 ? (
          <div className="text-soft italic">
            {running
              ? "Waiting for the first server event…"
              : "Logs will appear here once you start a run."}
          </div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="log-line">
              <span className="log-time">[{fmtTime(l.ts)}]</span>
              <span className={`log-${l.level}`}>{l.message}</span>
            </div>
          ))
        )}
        {running && (
          <div className="log-line">
            <span className="log-time">[•]</span>
            <span className="log-info">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 animate-pulseDot align-middle" />
              <span className="text-soft">in progress…</span>
            </span>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent rounded-b-xl" />
    </div>
  );
}
