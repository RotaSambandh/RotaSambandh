import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { htmlToPlainText } from "@/lib/sanitize/html";
import { cn } from "@/lib/utils";

export function CompanySummaryCard({
  businessId,
  name,
  logoUrl,
  industry,
  companySize,
  location,
  about,
  verified,
  href,
  linkToCompany = true,
}: {
  businessId: string;
  name: string;
  logoUrl?: string | null;
  industry?: string | null;
  companySize?: string | null;
  location?: string | null;
  about?: string | null;
  verified?: boolean;
  href?: string;
  /** When false, show name/logo but do not link to a company page (avoids 404). */
  linkToCompany?: boolean;
}) {
  const companyHref = href ?? (businessId ? `/companies/${businessId}` : undefined);
  const canLink = Boolean(linkToCompany && companyHref);
  const meta = [industry, companySize, location].filter(Boolean).join(" · ");
  const summary = about ? htmlToPlainText(about).slice(0, 180) : "";

  const nameEl = (
    <span className="text-body font-semibold text-[var(--color-ink)]">{name}</span>
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex items-center gap-3">
        <CompanyAvatar name={name} logoUrl={logoUrl ?? undefined} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {canLink ? (
              <Link
                href={companyHref!}
                className="text-body font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]"
              >
                {name}
              </Link>
            ) : (
              nameEl
            )}
            {verified ? <Badge variant="success">Verified</Badge> : null}
          </div>
          {meta ? <p className="mt-1 text-caption text-[var(--color-muted)]">{meta}</p> : null}
        </div>
      </div>
      {summary ? (
        <p className="mt-3 text-caption text-[var(--color-muted)]">
          {summary}
          {summary.length >= 180 ? "…" : ""}
        </p>
      ) : null}
      {canLink ? (
        <div className="mt-4">
          <Link
            href={companyHref!}
            className={cn(buttonClassName("secondary", "sm"))}
          >
            View company
          </Link>
        </div>
      ) : null}
    </div>
  );
}
