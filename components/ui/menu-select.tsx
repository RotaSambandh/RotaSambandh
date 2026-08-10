"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

export function MenuSelect({
  name,
  id,
  label,
  options,
  defaultValue = "",
  value: valueProp,
  onValueChange,
  className,
  triggerClassName,
  disabled = false,
  placeholder = "Select",
  searchable = false,
  searchPlaceholder = "Search...",
  emptyMessage,
}: {
  name?: string;
  id?: string;
  label?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when search yields no options (searchable only). */
  emptyMessage?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-list`;
  const searchId = `${fieldId}-search`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const value = isControlled ? valueProp : uncontrolledValue;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => {
      if (!o.value) return false;
      return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
    });
  }, [options, query, searchable]);

  useEffect(() => {
    if (!isControlled) setUncontrolledValue(defaultValue);
  }, [defaultValue, isControlled]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
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
  }, [open, searchable]);

  function commit(next: string) {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
    setOpen(false);
  }

  const showEmpty =
    searchable && query.trim().length > 0 && filtered.length === 0 && Boolean(emptyMessage);

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-border)]",
          "bg-white px-3 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-sm transition",
          "hover:border-[var(--color-accent)]/45",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]",
          triggerClassName,
        )}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={cn("truncate", !value && "text-[var(--color-muted)]")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && !disabled ? (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" aria-hidden />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
          {showEmpty ? (
            <p className="px-3 py-3 text-sm leading-relaxed text-[var(--color-muted)]">
              {emptyMessage}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={fieldId}
              className="max-h-60 overflow-auto py-1"
            >
              {filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value || "__empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition",
                        isSelected
                          ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-strong)]"
                          : "text-[var(--color-ink)] hover:bg-[var(--color-surface)]",
                      )}
                      onClick={() => commit(option.value)}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
