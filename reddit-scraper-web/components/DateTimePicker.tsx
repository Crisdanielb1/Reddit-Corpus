"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "00:00" };
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/
  );
  if (!m) return { date: undefined, time: "00:00" };
  const [, yr, mo, dy, hh, mm] = m;
  const date = new Date(Number(yr), Number(mo) - 1, Number(dy));
  const time = `${hh ?? "00"}:${mm ?? "00"}`;
  return { date, time };
}

function buildValue(date: Date | undefined, time: string): string {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${time}`;
}

function formatLabel(date: Date | undefined, time: string): string {
  if (!date) return "";
  return `${pad(date.getDate())} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()} · ${time}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  disabled,
  minDate,
  maxDate,
}: Props) {
  const { date, time } = parseValue(value);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(date);
  const [draftTime, setDraftTime] = useState<string>(time);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraftDate(date);
      setDraftTime(time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(nextDate: Date | undefined, nextTime: string) {
    onChange(buildValue(nextDate, nextTime));
  }

  function clear() {
    setDraftDate(undefined);
    setDraftTime("00:00");
    onChange("");
    setOpen(false);
  }

  function applyNow() {
    let target = new Date();
    if (maxDate && target > maxDate) target = new Date(maxDate);
    if (minDate && target < minDate) target = new Date(minDate);
    const nextTime = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setDraftDate(target);
    setDraftTime(nextTime);
    commit(target, nextTime);
    setOpen(false);
  }

  const label = formatLabel(date, time);
  const startMonth = minDate ?? new Date(2005, 0);
  const endMonth = maxDate ?? new Date(new Date().getFullYear() + 1, 11);
  const disabledDays: Array<{ before: Date } | { after: Date }> = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="field-button"
        data-open={open ? "true" : "false"}
        data-empty={label ? "false" : "true"}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted" />
          <span className="truncate">{label || placeholder}</span>
        </span>
        {label && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear"
            className="text-soft hover:text-ink transition-colors p-0.5 rounded hover:bg-line2"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }
            }}
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div
          className="popover mt-2 left-0 right-auto"
          style={{ minWidth: 320 }}
        >
          <DayPicker
            mode="single"
            selected={draftDate}
            onSelect={(d) => {
              setDraftDate(d);
              if (d) commit(d, draftTime);
            }}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={draftDate ?? maxDate ?? new Date()}
            disabled={disabledDays.length ? disabledDays : undefined}
            showOutsideDays
            weekStartsOn={1}
          />

          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted font-medium">
              Time
              <input
                type="time"
                className="field !py-1.5 !px-2.5 !w-auto text-sm"
                value={draftTime}
                onChange={(e) => {
                  const t = e.target.value || "00:00";
                  setDraftTime(t);
                  if (draftDate) commit(draftDate, t);
                }}
              />
            </label>

            <div className="flex-1" />

            <button
              type="button"
              className="btn btn-ghost !py-1.5 !px-3 text-xs"
              onClick={applyNow}
            >
              Now
            </button>
            <button
              type="button"
              className="btn btn-ghost !py-1.5 !px-3 text-xs"
              onClick={clear}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary !py-1.5 !px-3 text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
