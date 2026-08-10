import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { JobCard } from "@/components/jobs/job-card";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { RichTextView } from "@/components/editor/rich-text-view";
import { htmlToPlainText } from "@/lib/sanitize/html";
import { getBusinessBySlug, getBusinessOpenJobs, getBusinessPublic } from "@/lib/dal/businesses";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}): Promise<Metadata> {
  const { businessId } = await params;
  const business =
    (await getBusinessPublic(businessId)) ?? (await getBusinessBySlug(businessId));
  if (!business) return { title: "Company not found" };
  const desc = business.description
    ? htmlToPlainText(business.description).slice(0, 160)
    : `${business.name} on RotaSambandh`;
  return {
    title: business.name,
    description: desc,
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business =
    (await getBusinessPublic(businessId)) ?? (await getBusinessBySlug(businessId));
  if (!business) notFound();
  const jobs = await getBusinessOpenJobs(business.id);

  return (
    <main>
      {business.coverUrl ? (
        <div
          className="mb-6 h-36 w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] bg-cover bg-center sm:h-44"
          style={{ backgroundImage: `url(${business.coverUrl})` }}
          aria-hidden
        />
      ) : null}

      <PageHeader
        breadcrumb={
          <>
            <Link href="/jobs" className="font-medium text-[var(--color-accent-strong)] hover:underline">
              Opportunities
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate">{business.name}</span>
          </>
        }
        title={business.name}
        description={[business.industry, business.location, business.companySize]
          .filter(Boolean)
          .join(" · ")}
        actions={
          business.verified ? (
            <Badge variant="success">Verified</Badge>
          ) : undefined
        }
      />

      <div className="mb-8 flex flex-wrap items-start gap-4">
        <CompanyAvatar name={business.name} logoUrl={business.logoUrl} size={64} />
        <div className="min-w-0 flex-1 space-y-3">
          {business.description ? (
            <RichTextView html={business.description} className="text-[var(--color-muted)]" />
          ) : null}
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-[var(--color-accent-strong)] hover:underline"
            >
              Visit website
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          {(business.rotaryContactName || business.rotaryContactClub) && (
            <p className="text-caption text-[var(--color-ink)]">
              <span className="text-[var(--color-muted)]">Rotary / Rotaract contact: </span>
              {[business.rotaryContactName, business.rotaryContactClub]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <Panel title="Open opportunities">
        {jobs.length === 0 ? (
          <EmptyState
            title="No open roles right now"
            description="Check back later for new opportunities from this company."
          />
        ) : (
          <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </Panel>
    </main>
  );
}
