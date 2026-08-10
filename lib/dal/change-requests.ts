import {
  collection,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { get, ref } from "firebase/database";
import type {
  Business,
  ChangeRequest,
  ChangeRequestAction,
  ChangeRequestStatus,
  ChangeRequestTarget,
  Job,
} from "@/shared/types";
import {
  getClientFirestore,
  getClientRtdb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { now, omitUndefined, slugify } from "@/lib/utils";
import { assertBusinessAcceptsMutations } from "@/lib/dal/business-guards";
import { getEmployerMetaRtdb, listChangeRequestsForBusinessRtdb } from "@/lib/dal/employer-rtdb";
import { listPendingChangeRequestsRtdb } from "@/lib/dal/admin-rtdb";

function demoStore(): ChangeRequest[] {
  if (typeof globalThis === "undefined") return [];
  const g = globalThis as unknown as { __rsChangeRequests?: ChangeRequest[] };
  if (!g.__rsChangeRequests) g.__rsChangeRequests = [];
  return g.__rsChangeRequests;
}

export async function createChangeRequest(input: {
  targetType: ChangeRequestTarget;
  targetId: string;
  businessId: string;
  action: ChangeRequestAction;
  proposed: Record<string, unknown>;
  liveSnapshot?: Record<string, unknown>;
  submittedBy: string;
  title?: string;
  submit?: boolean;
}): Promise<ChangeRequest> {
  if (isFirebaseConfigured()) {
    const biz = await getEmployerMetaRtdb(input.businessId);
    if (biz) {
      assertBusinessAcceptsMutations(biz);
    }
  }

  const ts = now();
  const id = isFirebaseConfigured()
    ? doc(collection(getClientFirestore(), "changeRequests")).id
    : `cr_${ts}`;

  const cr = omitUndefined({
    id,
    targetType: input.targetType,
    targetId: input.targetId,
    businessId: input.businessId,
    action: input.action,
    proposed: input.proposed,
    liveSnapshot: input.liveSnapshot,
    status: (input.submit ? "pending_review" : "draft") as ChangeRequestStatus,
    submittedBy: input.submittedBy,
    title: input.title,
    createdAt: ts,
    updatedAt: ts,
  }) as ChangeRequest;

  if (!isFirebaseConfigured()) {
    demoStore().unshift(cr);
    return cr;
  }

  await setDoc(
    doc(getClientFirestore(), "changeRequests", id),
    omitUndefined(cr as unknown as Record<string, unknown>),
  );
  return cr;
}

export async function submitChangeRequest(id: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    const item = demoStore().find((c) => c.id === id);
    if (item) {
      item.status = "pending_review";
      item.updatedAt = now();
    }
    return;
  }
  await updateDoc(doc(getClientFirestore(), "changeRequests", id), {
    status: "pending_review" satisfies ChangeRequestStatus,
    updatedAt: now(),
  });
}

export async function listChangeRequestsForBusiness(businessId: string): Promise<ChangeRequest[]> {
  if (!isFirebaseConfigured()) {
    return demoStore().filter((c) => c.businessId === businessId);
  }
  return listChangeRequestsForBusinessRtdb(businessId);
}

export async function listPendingChangeRequests(): Promise<ChangeRequest[]> {
  if (!isFirebaseConfigured()) {
    return demoStore().filter((c) => c.status === "pending_review");
  }
  return listPendingChangeRequestsRtdb();
}

export async function getChangeRequest(id: string): Promise<ChangeRequest | null> {
  if (!isFirebaseConfigured()) {
    return demoStore().find((c) => c.id === id) ?? null;
  }
  try {
    const snap = await get(
      ref(getClientRtdb(), `admin/queues/changeRequests/${id}`),
    );
    if (!snap.exists()) return null;
    const c = snap.val() as Record<string, unknown>;
    return {
      id,
      businessId: String(c.businessId ?? ""),
      targetType: c.targetType as ChangeRequest["targetType"],
      targetId: String(c.targetId ?? ""),
      action: "update",
      proposed: {},
      status: c.status as ChangeRequest["status"],
      submittedBy: String(c.submittedBy ?? ""),
      adminNote: c.adminNote ? String(c.adminNote) : undefined,
      createdAt: Number(c.submittedAt ?? 0),
      updatedAt: Number(c.submittedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export async function reviewChangeRequestLocal(input: {
  id: string;
  decision: "approved" | "rejected" | "info_requested";
  adminId: string;
  adminNote?: string;
}): Promise<ChangeRequest | null> {
  /** Production reviews go through /api/admin/privileged */
  if (isFirebaseConfigured()) {
    throw new Error("Use privileged admin API to review change requests");
  }
  const item = demoStore().find((c) => c.id === input.id);
  if (!item) return null;
  item.status = input.decision;
  item.adminNote = input.adminNote;
  item.reviewedBy = input.adminId;
  item.reviewedAt = now();
  item.updatedAt = now();
  return item;
}

export function businessLiveSnapshot(b: Business): Record<string, unknown> {
  return {
    name: b.name,
    description: b.description ?? "",
    website: b.website ?? "",
    industry: b.industry ?? "",
    companySize: b.companySize ?? "",
    location: b.location ?? "",
    logoUrl: b.logoUrl ?? "",
    coverUrl: b.coverUrl ?? "",
    socialLinks: b.socialLinks ?? {},
    rotaryContactName: b.rotaryContactName ?? "",
    rotaryContactClub: b.rotaryContactClub ?? "",
    rotaryContactEmail: b.rotaryContactEmail ?? "",
    rotaryContactPhone: b.rotaryContactPhone ?? "",
    slug: b.slug,
  };
}

export function jobLiveSnapshot(j: Job): Record<string, unknown> {
  return {
    title: j.title,
    slug: j.slug,
    description: j.description,
    responsibilities: j.responsibilities ?? "",
    requirements: j.requirements ?? "",
    benefits: j.benefits ?? "",
    skills: j.skills,
    type: j.type,
    workplace: j.workplace,
    location: j.location ?? "",
    salaryDisplay: j.salaryDisplay ?? "",
    deadline: j.deadline ?? null,
    industry: j.industry ?? "",
    categoryIds: j.categoryIds,
  };
}

export function proposedBusinessSlug(name: string): string {
  return slugify(name);
}
