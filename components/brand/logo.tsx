import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Circle handshake mark — preferred brand signal for UI chrome. */
export const BRAND_MARK_SRC = "/brand/mark-circle.webp";

export function Logo({
  className,
  compact = false,
  tone = "dark",
  markOnly = false,
}: {
  className?: string;
  compact?: boolean;
  tone?: "dark" | "light";
  /** Icon only (e.g. tight mobile chrome). */
  markOnly?: boolean;
}) {
  const ink = tone === "light" ? "text-white" : "text-[var(--color-ink)]";
  const accent = tone === "light" ? "text-[var(--color-accent-soft)]" : "text-[var(--color-accent)]";
  const size = compact || markOnly ? 28 : 36;

  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="RotaSambandh home"
    >
      <Image
        src={BRAND_MARK_SRC}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        priority
      />
      {!markOnly ? (
        <>
          <span
            className={cn(
              "font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]",
              ink,
            )}
          >
            Rota<span className={accent}>Sambandh</span>
          </span>
          {!compact ? (
            <span
              className={cn(
                "font-nav hidden text-[11px] md:inline",
                tone === "light" ? "text-white/60" : "text-[var(--color-muted)]",
              )}
            >
              Career Network
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}
