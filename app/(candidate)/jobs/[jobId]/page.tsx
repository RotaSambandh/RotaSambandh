import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Banner } from "@/components/ui";
import { ReportJobButton } from "@/components/jobs/report-job-button";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { getJobDetail } from "@/lib/dal/jobs";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { DISPLAY_NAME } from "@/shared/constants";
import { htmlToPlainText } from "@/lib/sanitize/html";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);
  if (!job) return { title: "Job not found" };
  const description = htmlToPlainText(job.description).slice(0, 160) || job.description.slice(0, 160);
  return {
    title: `${job.title} at ${job.company}`,
    description,
    openGraph: {
      title: `${job.title} · ${job.company}`,
      description,
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);
  if (!job) notFound();

  const open = isJobOpenForApplications(job);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: new Date(job.postedAt).toISOString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      logo: job.companyLogo || undefined,
    },
    jobLocation: job.location
      ? {
          "@type": "Place",
          address: job.location,
        }
      : undefined,
    employmentType: job.type.toUpperCase(),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <PageHeader
          breadcrumb={
            <Link href="/jobs" className="text-sm font-medium uppercase tracking-[0.12em]">
              {DISPLAY_NAME} · All jobs
            </Link>
          }
          title={job.title}
          description={
            <span className="inline-flex items-center gap-2">
              <CompanyAvatar name={job.company} logoUrl={job.companyLogo} size={28} />
              <Link href={`/companies/${job.businessId}`} className="hover:underline">
                {job.company}
              </Link>
              {job.location ? ` · ${job.location}` : ""}
            </span>
          }
        />
        <div className="mb-8 flex flex-wrap gap-2">
          <Badge>{JOB_TYPE_LABELS[job.type]}</Badge>
          <Badge variant="neutral">{WORKPLACE_LABELS[job.workplace]}</Badge>
          {job.salary && <Badge variant="neutral">{job.salary}</Badge>}
        </div>
        <div className="prose mt-8 max-w-none space-y-6 text-[var(--color-ink)]">
          <section>
            <h2 className="font-display text-xl font-semibold">About the role</h2>
            <p className="mt-2 leading-relaxed text-[var(--color-muted)]">{job.description}</p>
          </section>
          {job.responsibilities && (
            <section>
              <h2 className="font-display text-xl font-semibold">Responsibilities</h2>
              <p className="mt-2 leading-relaxed text-[var(--color-muted)]">{job.responsibilities}</p>
            </section>
          )}
          {job.requirements && (
            <section>
              <h2 className="font-display text-xl font-semibold">Requirements</h2>
              <p className="mt-2 leading-relaxed text-[var(--color-muted)]">{job.requirements}</p>
            </section>
          )}
          {job.benefits && (
            <section>
              <h2 className="font-display text-xl font-semibold">Benefits</h2>
              <p className="mt-2 leading-relaxed text-[var(--color-muted)]">{job.benefits}</p>
            </section>
          )}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {open ? (
            <Link href={`/candidate/apply/${job.id}`}>
              <Button className="min-w-44">Apply now</Button>
            </Link>
          ) : (
            <Banner tone="warning" title="Applications closed">
              The deadline for this opportunity has passed.
            </Banner>
          )}
          <ReportJobButton jobId={job.id} />
        </div>
      </article>
    </main>
  );
}
