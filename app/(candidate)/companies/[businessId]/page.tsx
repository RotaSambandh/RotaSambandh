import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
      <article>
        <div className="flex flex-wrap items-center gap-3">
          <CompanyAvatar name={business.name} logoUrl={business.logoUrl} size={56} />
          <h1 className="font-display text-4xl font-semibold">{business.name}</h1>
          {business.verified && (
            <Badge variant="success">Verified Rotary Ecosystem Business</Badge>
          )}
        </div>
        <div className="mt-3 max-w-2xl">
          <RichTextView html={business.description} className="text-[var(--color-muted)]" />
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {[business.industry, business.location, business.companySize].filter(Boolean).join(" · ")}
        </p>
        {(business.rotaryContactName || business.rotaryContactClub) && (
          <p className="mt-3 text-sm text-[var(--color-ink)]">
            <span className="text-[var(--color-muted)]">Rotary / Rotaract contact: </span>
            {[business.rotaryContactName, business.rotaryContactClub].filter(Boolean).join(" · ")}
          </p>
        )}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Open opportunities</h2>
          <div className="mt-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
