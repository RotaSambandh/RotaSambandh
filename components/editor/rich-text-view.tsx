import { sanitizeCompanyHtml } from "@/lib/sanitize/html";
import { cn } from "@/lib/utils";

export function RichTextView({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  if (!html?.trim()) return null;
  const clean = sanitizeCompanyHtml(html);
  if (!clean) return null;
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-[var(--color-ink)] prose-a:text-[var(--color-accent-strong)]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
