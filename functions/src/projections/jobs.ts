import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";
import { projectEmployerJob, removeEmployerJob } from "./employer";

export interface JobDoc {
  id: string;
  businessId: string;
  title: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  skills?: string[];
  type: string;
  workplace: string;
  location?: string;
  salaryDisplay?: string;
  industry?: string;
  status: string;
  deadline?: number;
  featured?: boolean;
  postedAt?: number;
}

export interface BusinessDoc {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  status: string;
}

/** Public feeds + detail only for published; employer workspace for all statuses. */
export async function projectJob(job: JobDoc, business?: BusinessDoc | null) {
  await projectEmployerJob(job, business);

  if (job.status !== "published") {
    await removePublicJobProjections(job.id, job.type, job.workplace);
    return;
  }

  const db = getDatabase();
  const feedItem = {
    id: job.id,
    title: job.title,
    company: business?.name ?? "Company",
    companyLogo: business?.logoUrl,
    businessId: job.businessId,
    location: job.location,
    workplace: job.workplace,
    type: job.type,
    salary: job.salaryDisplay,
    skills: job.skills ?? [],
    postedAt: job.postedAt ?? Date.now(),
    deadline: job.deadline,
    featured: job.featured ?? false,
    readModelVersion: READ_MODEL_VERSION,
  };

  const detail = {
    ...feedItem,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    industry: job.industry,
    companySummary: business?.description,
    applicationConfig: { questionCount: 0 },
    readModelVersion: READ_MODEL_VERSION,
  };

  const updates: Record<string, unknown> = {
    [`jobs/${job.id}`]: detail,
    [`feeds/latest/${job.id}`]: feedItem,
    [`feeds/${job.type}/${job.id}`]: feedItem,
    [`feeds/${job.workplace}/${job.id}`]: feedItem,
  };

  await db.ref().update(updates);
}

async function removePublicJobProjections(
  jobId: string,
  type?: string,
  workplace?: string,
) {
  const db = getDatabase();
  const updates: Record<string, null> = {
    [`jobs/${jobId}`]: null,
    [`feeds/latest/${jobId}`]: null,
  };
  if (type) updates[`feeds/${type}/${jobId}`] = null;
  if (workplace) updates[`feeds/${workplace}/${jobId}`] = null;
  await db.ref().update(updates);
}

export async function removeJobProjections(
  jobId: string,
  type?: string,
  workplace?: string,
  businessId?: string,
) {
  await removePublicJobProjections(jobId, type, workplace);
  if (businessId) await removeEmployerJob(businessId, jobId);
}

export async function invalidateNetlifyCache(tags: string[]) {
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteId || !token || tags.length === 0) return;

  await fetch(`https://api.netlify.com/api/v1/purge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: siteId, cache_tags: tags }),
  }).catch(() => undefined);
}
