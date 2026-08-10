import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import type {
  AdminAction,
  Business,
  BusinessVerification,
  Job,
  UserDoc,
} from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, omitUndefined } from "@/lib/utils";
import {
  listAdminQueueBusinessesRtdb,
  listAdminQueueJobsRtdb,
  listPendingJobsRtdb,
  getLatestVerificationForBusinessRtdb,
  listPendingVerificationsRtdb,
  listStaffUsersRtdb,
} from "@/lib/dal/admin-rtdb";
import { getEmployerJobRtdb, getEmployerMetaRtdb } from "@/lib/dal/employer-rtdb";
import { get, ref } from "firebase/database";
import { getClientRtdb } from "@/lib/firebase/client";

async function logAdminAction(input: Omit<AdminAction, "id" | "createdAt" | "updatedAt">) {
  if (!isFirebaseConfigured()) return;
  const ts = now();
  const refDoc = doc(collection(getClientFirestore(), "adminActions"));
  await setDoc(refDoc, { ...input, id: refDoc.id, createdAt: ts, updatedAt: ts });
}

export async function listPendingVerifications(): Promise<BusinessVerification[]> {
  return listPendingVerificationsRtdb();
}

export async function getLatestVerificationForBusiness(
  businessId: string,
): Promise<BusinessVerification | null> {
  return getLatestVerificationForBusinessRtdb(businessId);
}

/** @deprecated Use reviewVerificationAdmin from admin-server via privileged API. */
export async function reviewVerification(_input: {
  verificationId: string;
  businessId: string;
  adminId: string;
  decision: "approved" | "rejected" | "info_requested";
  adminNote?: string;
}) {
  throw new Error("Use privileged Admin SDK path (reviewVerificationAdmin)");
}

export async function listPendingJobs(): Promise<Job[]> {
  return listPendingJobsRtdb();
}

export async function listAllJobs(pageSize = 100): Promise<Job[]> {
  const jobs = await listAdminQueueJobsRtdb();
  return jobs
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, pageSize);
}

export async function getAdminJob(jobId: string): Promise<Job | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const queueSnap = await get(ref(getClientRtdb(), `admin/queues/jobs/${jobId}`));
    if (!queueSnap.exists()) return null;
    const j = queueSnap.val() as Record<string, unknown>;
    const businessId = String(j.businessId ?? "");
    let hydrated: Job | null = null;
    if (businessId) {
      hydrated = await getEmployerJobRtdb(businessId, jobId);
    }
    return {
      id: jobId,
      businessId,
      title: hydrated?.title || String(j.title ?? ""),
      description: hydrated?.description ?? "",
      responsibilities: hydrated?.responsibilities,
      requirements: hydrated?.requirements,
      benefits: hydrated?.benefits,
      skills: hydrated?.skills ?? [],
      categoryIds: [],
      createdBy: "",
      status: (hydrated?.status || j.status) as Job["status"],
      type: hydrated?.type || (j.type as Job["type"]) || "full_time",
      workplace:
        hydrated?.workplace || (j.workplace as Job["workplace"]) || "remote",
      location: hydrated?.location,
      salaryDisplay: hydrated?.salaryDisplay,
      industry: hydrated?.industry,
      deadline: hydrated?.deadline,
      postedAt: hydrated?.postedAt,
      slug: "",
      createdAt: Number(j.updatedAt ?? hydrated?.createdAt ?? 0),
      updatedAt: Number(j.updatedAt ?? hydrated?.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export async function listAllBusinesses(pageSize = 100): Promise<Business[]> {
  const list = await listAdminQueueBusinessesRtdb();
  const hydrated = await Promise.all(
    list.map(async (stub) => {
      const meta = await getEmployerMetaRtdb(stub.id);
      if (!meta) return stub;
      return {
        ...stub,
        ...meta,
        // Prefer live meta status/name; keep stub timestamps if meta lacks them.
        status: meta.status ?? stub.status,
        name: meta.name || stub.name,
        updatedAt: Math.max(meta.updatedAt ?? 0, stub.updatedAt ?? 0),
      };
    }),
  );
  return hydrated.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, pageSize);
}

export async function getAdminBusiness(businessId: string): Promise<Business | null> {
  return getEmployerMetaRtdb(businessId);
}

/** @deprecated Use moderateJobAdmin from admin-server via privileged API. */
export async function moderateJob(_input: {
  jobId: string;
  adminId: string;
  decision: "published" | "rejected" | "closed";
  note?: string;
  featured?: boolean;
}) {
  throw new Error("Use privileged Admin SDK path (moderateJobAdmin)");
}

/** @deprecated Use setUserSuspendedAdmin from admin-server via privileged API. */
export async function setUserSuspended(_input: {
  userId: string;
  adminId: string;
  suspended: boolean;
}) {
  throw new Error("Use privileged Admin SDK path (setUserSuspendedAdmin)");
}

export async function suspendBusiness(input: { businessId: string; adminId: string }) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getClientFirestore(), "businesses", input.businessId), {
    status: "suspended",
    updatedAt: now(),
  });
  await logAdminAction({
    adminId: input.adminId,
    action: "business_suspend",
    targetType: "business",
    targetId: input.businessId,
  });
}

export async function listBusinessesByStatus(
  status: Business["status"],
): Promise<Business[]> {
  const list = await listAdminQueueBusinessesRtdb();
  return list.filter((b) => b.status === status);
}

export async function searchUsers(emailPrefix: string): Promise<UserDoc[]> {
  if (!emailPrefix.trim()) return [];
  const staff = await listStaffUsersRtdb();
  const prefix = emailPrefix.toLowerCase();
  return staff.filter((u) => u.email.toLowerCase().startsWith(prefix));
}
