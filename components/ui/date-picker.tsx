"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(value: string): string {
  const d = parseIsoDate(value);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
  name,
  id,
  label,
  defaultValue = "",
  value: valueProp,
  onValueChange,
  disabled = false,
  className,
}: {
  name?: string;
  id?: string;
  label?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const value = isControlled ? valueProp : uncontrolledValue;
  const selectedDate = parseIsoDate(value);
  const [view, setView] = useState(() => selectedDate ?? new Date());

  useEffect(() => {
    if (!isControlled) setUncontrolledValue(defaultValue);
  }, [defaultValue, isControlled]);

  useEffect(() => {
    const next = parseIsoDate(value);
    if (next) setView(next);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const items: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startPad; i++) {
      items.push({ date: new Date(year, month, i - startPad + 1), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      items.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (items.length % 7 !== 0) {
      const last = items[items.length - 1]!.date;
      items.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return items;
  }, [view]);

  function commit(next: string) {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
    setOpen(false);
  }

  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]"
        >
          {label}
        </label>
      ) : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={fieldId}
        type="button"
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-border)]",
          "bg-white px-3 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition",
          "hover:border-[var(--color-accent)]/45",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]",
        )}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={cn("truncate", !value && "text-[var(--color-muted)]")}>
          {value ? formatDisplay(value) : "Pick a date"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 z-40 mt-1.5 w-72 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--color-ink)]">{monthLabel}</p>
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const iso = toIsoDate(date);
              const isSelected = value === iso;
              const isToday = toIsoDate(new Date()) === iso;
              return (
                <button
                  key={iso + String(inMonth)}
                  type="button"
                  disabled={!inMonth}
                  className={cn(
                    "aspect-square rounded-md text-sm transition",
                    !inMonth && "invisible",
                    inMonth && !isSelected && "text-[var(--color-ink)] hover:bg-[var(--color-surface)]",
                    isSelected && "bg-[var(--color-accent)] font-semibold text-white",
                    isToday && !isSelected && "ring-1 ring-[var(--color-accent)]",
                  )}
                  onClick={() => commit(iso)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--color-border)] pt-2">
            <button
              type="button"
              className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              onClick={() => commit("")}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--color-accent-strong)] hover:underline"
              onClick={() => commit(toIsoDate(new Date()))}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
