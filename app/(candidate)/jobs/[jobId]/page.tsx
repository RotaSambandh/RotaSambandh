import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Banner,
  Panel,
  ReviewWorkbenchFrame,
} from "@/components/ui";
import { JobMetaRow } from "@/components/jobs/job-meta-row";
import { JobPostingBody } from "@/components/jobs/job-posting-body";
import { CompanySummaryCard } from "@/components/jobs/company-summary-card";
import { JobCard } from "@/components/jobs/job-card";
import { ShareJobButton } from "@/components/jobs/share-job-button";
import { getJobDetail } from "@/lib/dal/jobs";
import { getBusinessPublic, getBusinessOpenJobs } from "@/lib/dal/businesses";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";
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
  const description =
    htmlToPlainText(job.description).slice(0, 160) || job.description.slice(0, 160);
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

  const [business, openJobs] = await Promise.all([
    getBusinessPublic(job.businessId),
    getBusinessOpenJobs(job.businessId),
  ]);

  const open = isJobOpenForApplications(job);
  const moreJobs = openJobs.filter((j) => j.id !== job.id).slice(0, 5);
  const about = business?.description || job.companySummary;

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
      <PageHeader
        breadcrumb={
          <>
            <Link href="/jobs" className="font-medium text-[var(--color-accent-strong)] hover:underline">
              Opportunities
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate">{job.title}</span>
          </>
        }
        title={job.title}
        description={`${DISPLAY_NAME} · ${job.company}${job.location ? ` · ${job.location}` : ""}`}
        actions={<ShareJobButton title={job.title} />}
      />

      <ReviewWorkbenchFrame
        primary={
          <>
            <JobMetaRow
              type={job.type}
              workplace={job.workplace}
              location={job.location}
              salary={job.salary}
              postedAt={job.postedAt}
              deadline={job.deadline}
              featured={job.featured}
            />
            <Panel>
              <JobPostingBody
                description={job.description}
                responsibilities={job.responsibilities}
                requirements={job.requirements}
                benefits={job.benefits}
              />
            </Panel>
            {moreJobs.length > 0 ? (
              <Panel title={`More jobs at ${job.company}`}>
                <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
                  {moreJobs.map((item) => (
                    <JobCard key={item.id} job={item} />
                  ))}
                </div>
              </Panel>
            ) : null}
          </>
        }
        rail={
          <>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              {open ? (
                <Link href={`/candidate/apply/${job.id}`} className="block">
                  <Button className="w-full">Apply now</Button>
                </Link>
              ) : (
                <Banner tone="warning" title="Applications closed">
                  The deadline for this opportunity has passed.
                </Banner>
              )}
              <JobMetaRow
                className="mt-3"
                type={job.type}
                workplace={job.workplace}
                location={job.location}
                salary={job.salary}
                postedAt={job.postedAt}
                deadline={job.deadline}
              />
            </div>
            <CompanySummaryCard
              businessId={job.businessId}
              name={business?.name ?? job.company}
              logoUrl={business?.logoUrl ?? job.companyLogo}
              industry={business?.industry}
              companySize={business?.companySize}
              location={business?.location ?? job.location}
              about={about}
              verified={Boolean(business?.verified)}
            />
          </>
        }
      />

      {/* Mobile sticky apply */}
      {open ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 p-3 backdrop-blur md:hidden">
          <Link href={`/candidate/apply/${job.id}`}>
            <Button className="w-full">Apply now</Button>
          </Link>
        </div>
      ) : null}
    </main>
  );
}
