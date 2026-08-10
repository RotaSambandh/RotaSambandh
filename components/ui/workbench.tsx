import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  info: "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
  success: "border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]",
  danger: "border-red-200 bg-red-50 text-[var(--color-danger)]",
};

const icons: Record<Tone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function Banner({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      role="status"
      className={cn("flex gap-3 rounded border px-4 py-3 text-sm", tones[tone], className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border border-dashed border-[var(--color-border)] px-6 py-12 text-center", className)}>
      <p className="font-semibold text-[var(--color-ink)]">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {breadcrumb && <div className="mb-2 text-sm text-[var(--color-muted)]">{breadcrumb}</div>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description && <div className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={cn("border border-[var(--color-border)] bg-white", className)}>
      {title && (
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: Array<{ id: string; label: string }>;
  current: string;
}) {
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex gap-1" aria-label="Progress">
      {steps.map((step, i) => {
        const active = step.id === current;
        const done = i < idx;
        return (
          <li
            key={step.id}
            className={cn(
              "flex-1 rounded-sm px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide",
              active && "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
              done && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
              !active && !done && "bg-[var(--color-surface)] text-[var(--color-muted)]",
            )}
          >
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function FileUpload({
  id,
  label,
  accept,
  disabled,
  onFile,
  hint,
}: {
  id: string;
  label: string;
  accept?: string;
  disabled?: boolean;
  hint?: string;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="w-full rounded border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--color-accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--color-accent-strong)]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {hint && <p className="mt-1.5 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function DiffView({
  rows,
}: {
  rows: Array<{ field: string; before?: string; after?: string }>;
}) {
  return (
    <div className="overflow-x-auto border border-[var(--color-border)]">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-semibold">Field</th>
            <th className="px-3 py-2 font-semibold">Live</th>
            <th className="px-3 py-2 font-semibold">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const changed = (row.before ?? "") !== (row.after ?? "");
            return (
              <tr key={row.field} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">{row.field}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{row.before || "Not set"}</td>
                <td
                  className={cn(
                    "px-3 py-2",
                    changed && "bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]",
                  )}
                >
                  {row.after || "Not set"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--color-muted)]">
      {label}
    </div>
  );
}
