import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  documentId,
} from "firebase/firestore";
import type {
  Business,
  BusinessMember,
  BusinessStatus,
  BusinessVerification,
  Job,
  JobStatus,
  JobType,
  WorkplaceType,
} from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, omitUndefined, slugify } from "@/lib/utils";
import { assertBusinessAcceptsMutations } from "@/lib/dal/business-guards";

/** Wizard finished when verification was submitted (no longer a draft). */
export function isEmployerBusinessOnboarded(business: Business): boolean {
  return business.status !== "draft";
}

export async function createBusiness(input: {
  ownerId: string;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  location?: string;
  companySize?: string;
  logoUrl?: string;
  rotaryContactName?: string;
  rotaryContactClub?: string;
  rotaryContactEmail?: string;
  rotaryContactPhone?: string;
}): Promise<Business> {
  const ts = now();
  const id = isFirebaseConfigured() ? doc(collection(getClientFirestore(), "businesses")).id : `biz_${ts}`;
  const business: Business = omitUndefined({
    id,
    name: input.name,
    slug: slugify(input.name),
    description: input.description,
    website: input.website,
    industry: input.industry,
    location: input.location,
    companySize: input.companySize,
    logoUrl: input.logoUrl,
    rotaryContactName: input.rotaryContactName,
    rotaryContactClub: input.rotaryContactClub,
    rotaryContactEmail: input.rotaryContactEmail,
    rotaryContactPhone: input.rotaryContactPhone,
    status: "draft" as BusinessStatus,
    ownerId: input.ownerId,
    createdAt: ts,
    updatedAt: ts,
  }) as Business;

  if (!isFirebaseConfigured()) return business;

  const db = getClientFirestore();
  await setDoc(doc(db, "businesses", id), business);
  const memberId = `${id}_${input.ownerId}`;
  const member: BusinessMember = {
    id: memberId,
    businessId: id,
    userId: input.ownerId,
    role: "company_admin",
    status: "active",
    createdAt: ts,
    updatedAt: ts,
  };
  await setDoc(doc(db, "businessMembers", memberId), omitUndefined(member as unknown as Record<string, unknown>));
  await setDoc(
    doc(db, "users", input.ownerId),
    { activeBusinessId: id, updatedAt: ts },
    { merge: true },
  );

  return business;
}

export async function submitVerification(input: {
  businessId: string;
  submittedBy: string;
  affiliationType: BusinessVerification["affiliationType"];
  affiliationDetails: string;
  supportingInfo?: string;
}): Promise<BusinessVerification> {
  const ts = now();
  const id = isFirebaseConfigured()
    ? doc(collection(getClientFirestore(), "businessVerifications")).id
    : `ver_${ts}`;

  const verification: BusinessVerification = {
    id,
    businessId: input.businessId,
    submittedBy: input.submittedBy,
    affiliationType: input.affiliationType,
    affiliationDetails: input.affiliationDetails,
    supportingInfo: input.supportingInfo,
    status: "pending",
    createdAt: ts,
    updatedAt: ts,
  };

  if (!isFirebaseConfigured()) return verification;

  const db = getClientFirestore();
  await setDoc(doc(db, "businessVerifications", id), verification);
  await updateDoc(doc(db, "businesses", input.businessId), {
    status: "verification_pending" satisfies BusinessStatus,
    updatedAt: ts,
  });
  return verification;
}

export async function updateDraftBusiness(
  businessId: string,
  patch: {
    name?: string;
    description?: string;
    website?: string;
    industry?: string;
    location?: string;
    companySize?: string;
    logoUrl?: string;
    rotaryContactName?: string;
    rotaryContactClub?: string;
    rotaryContactEmail?: string;
    rotaryContactPhone?: string;
  },
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = doc(getClientFirestore(), "businesses", businessId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Business not found");
  const current = snap.data() as Business;
  assertBusinessAcceptsMutations(current);
  if (current.status !== "draft" && current.status !== "verification_pending") {
    throw new Error("Verified profiles must be updated through change requests");
  }
  const name = patch.name ?? current.name;
  await updateDoc(
    ref,
    omitUndefined({
      ...patch,
      name,
      slug: slugify(name),
      updatedAt: now(),
    }) as Record<string, unknown>,
  );
}

export async function createJob(input: {
  businessId: string;
  createdBy: string;
  title: string;
  description: string;
  type: JobType;
  workplace: WorkplaceType;
  skills?: string[];
  location?: string;
  salaryDisplay?: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  deadline?: number;
  industry?: string;
}): Promise<Job> {
  const ts = now();
  const id = isFirebaseConfigured() ? doc(collection(getClientFirestore(), "jobs")).id : `job_${ts}`;
  const status: JobStatus = "draft";

  const job: Job = {
    id,
    businessId: input.businessId,
    title: input.title,
    slug: slugify(input.title),
    description: input.description,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    benefits: input.benefits,
    skills: input.skills ?? [],
    type: input.type,
    workplace: input.workplace,
    location: input.location,
    salaryDisplay: input.salaryDisplay,
    industry: input.industry,
    categoryIds: [],
    status,
    deadline: input.deadline,
    createdBy: input.createdBy,
    createdAt: ts,
    updatedAt: ts,
  };

  if (!isFirebaseConfigured()) return job;

  const bizSnap = await getDoc(doc(getClientFirestore(), "businesses", input.businessId));
  if (!bizSnap.exists()) throw new Error("Business not found");
  assertBusinessAcceptsMutations(bizSnap.data() as Business);

  await setDoc(doc(getClientFirestore(), "jobs", id), job);
  return job;
}

export async function updateDraftJob(
  jobId: string,
  patch: Partial<
    Pick<
      Job,
      | "title"
      | "description"
      | "responsibilities"
      | "requirements"
      | "benefits"
      | "skills"
      | "type"
      | "workplace"
      | "location"
      | "salaryDisplay"
      | "deadline"
      | "industry"
    >
  >,
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const next: Record<string, unknown> = { ...patch, updatedAt: now() };
  if (patch.title) next.slug = slugify(patch.title);
  await updateDoc(doc(getClientFirestore(), "jobs", jobId), next);
}

export async function getJobById(jobId: string): Promise<Job | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "jobs", jobId));
  return snap.exists() ? (snap.data() as Job) : null;
}

export async function listBusinessJobs(businessId: string): Promise<Job[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "jobs"),
    where("businessId", "==", businessId),
    orderBy("updatedAt", "desc"),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Job);
}

export async function listOwnedBusinesses(userId: string): Promise<Business[]> {
  if (!isFirebaseConfigured()) return [];
  const membersSnap = await getDocs(
    query(collection(getClientFirestore(), "businessMembers"), where("userId", "==", userId), limit(40)),
  );
  const activeMembers = membersSnap.docs
    .map((d) => d.data() as BusinessMember)
    .filter((m) => m.status !== "revoked" && m.status !== "invited");
  const ids = Array.from(new Set(activeMembers.map((m) => m.businessId)));
  if (ids.length === 0) return [];

  // Batch get in chunks of 10 (Firestore `in` limit)
  const businesses: Business[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const snap = await getDocs(
      query(collection(getClientFirestore(), "businesses"), where(documentId(), "in", chunk)),
    );
    businesses.push(...snap.docs.map((d) => d.data() as Business));
  }
  // Stable-ish order: name then id
  businesses.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return businesses;
}

/** Resolve which company the employer UI should use. */
export async function resolveActiveBusiness(
  userId: string,
  preferredId?: string | null,
): Promise<{ businesses: Business[]; business: Business | null }> {
  const businesses = await listOwnedBusinesses(userId);
  if (businesses.length === 0) return { businesses, business: null };

  let preferred = preferredId ?? null;
  if (!preferred && isFirebaseConfigured()) {
    const userSnap = await getDoc(doc(getClientFirestore(), "users", userId));
    preferred = (userSnap.data()?.activeBusinessId as string | undefined) ?? null;
  }

  const match = preferred ? businesses.find((b) => b.id === preferred) : undefined;
  return { businesses, business: match ?? businesses[0] ?? null };
}

export async function setActiveBusinessId(userId: string, businessId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await setDoc(
    doc(getClientFirestore(), "users", userId),
    {
      activeBusinessId: businessId,
      updatedAt: now(),
    },
    { merge: true },
  );
}

export async function listBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    query(
      collection(getClientFirestore(), "businessMembers"),
      where("businessId", "==", businessId),
      limit(50),
    ),
  );
  return snap.docs.map((d) => d.data() as BusinessMember);
}

export async function inviteBusinessManager(input: {
  businessId: string;
  email: string;
  displayName?: string;
  invitedBy: string;
  role?: "manager" | "company_admin";
}): Promise<BusinessMember> {
  const res = await fetch("/api/employer/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "invite",
      businessId: input.businessId,
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? "manager",
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Invite failed");
  }
  const data = (await res.json()) as { member?: BusinessMember };
  if (data.member) return data.member;
  const ts = now();
  return {
    id: `${input.businessId}_invite`,
    businessId: input.businessId,
    userId: `pending`,
    role: input.role ?? "manager",
    email: input.email.trim().toLowerCase(),
    invitedBy: input.invitedBy,
    status: "invited",
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function revokeBusinessMember(businessId: string, userId: string): Promise<void> {
  const res = await fetch("/api/employer/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "revoke", businessId, userId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Revoke failed");
  }
}
