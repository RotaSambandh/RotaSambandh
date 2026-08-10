import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  showChevron = true,
  className,
  emphasize,
}: {
  href?: string;
  onClick?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  className?: string;
  emphasize?: boolean;
}) {
  const body = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-semibold text-[var(--color-ink)]">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-caption text-[var(--color-muted)]">{subtitle}</div>
        ) : null}
        {meta ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</div> : null}
      </div>
      {(trailing || showChevron) && (
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {showChevron ? (
            <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
          ) : null}
        </div>
      )}
    </>
  );

  const classes = cn(
    "flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left transition last:border-b-0",
    emphasize && "bg-[var(--color-warning-soft)]/40",
    (href || onClick) && "hover:bg-[var(--color-surface)]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}
