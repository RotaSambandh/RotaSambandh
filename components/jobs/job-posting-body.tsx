import { RichTextView } from "@/components/editor/rich-text-view";
import { isNonEmptyHtml } from "@/lib/sanitize/html";

export function JobPostingBody({
  description,
  responsibilities,
  requirements,
  benefits,
}: {
  description?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  benefits?: string | null;
}) {
  return (
    <div className="space-y-6 text-[var(--color-ink)]">
      {isNonEmptyHtml(description) ? (
        <section>
          <h2 className="text-subtitle text-[var(--color-ink)]">About the role</h2>
          <RichTextView html={description!} className="mt-2 text-[var(--color-muted)]" />
        </section>
      ) : null}
      {isNonEmptyHtml(responsibilities) ? (
        <section>
          <h2 className="text-subtitle text-[var(--color-ink)]">Responsibilities</h2>
          <RichTextView html={responsibilities!} className="mt-2 text-[var(--color-muted)]" />
        </section>
      ) : null}
      {isNonEmptyHtml(requirements) ? (
        <section>
          <h2 className="text-subtitle text-[var(--color-ink)]">Requirements</h2>
          <RichTextView html={requirements!} className="mt-2 text-[var(--color-muted)]" />
        </section>
      ) : null}
      {isNonEmptyHtml(benefits) ? (
        <section>
          <h2 className="text-subtitle text-[var(--color-ink)]">Benefits</h2>
          <RichTextView html={benefits!} className="mt-2 text-[var(--color-muted)]" />
        </section>
      ) : null}
    </div>
  );
}
