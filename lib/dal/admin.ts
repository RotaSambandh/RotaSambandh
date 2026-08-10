import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import type {
  AdminAction,
  Business,
  BusinessVerification,
  Job,
  Report,
  ReportReason,
  ReportStatus,
  UserDoc,
} from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, omitUndefined } from "@/lib/utils";
import {
  listAdminQueueBusinessesRtdb,
  listAdminQueueJobsRtdb,
  listPendingJobsRtdb,
  listPendingVerificationsRtdb,
  listReportsRtdb,
  listStaffUsersRtdb,
} from "@/lib/dal/admin-rtdb";
import { getEmployerMetaRtdb } from "@/lib/dal/employer-rtdb";
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
    const snap = await get(
      ref(getClientRtdb(), `admin/queues/jobs/${jobId}`),
    );
    if (!snap.exists()) return null;
    const j = snap.val() as Record<string, unknown>;
    return {
      id: jobId,
      businessId: String(j.businessId ?? ""),
      title: String(j.title ?? ""),
      description: "",
      skills: [],
      categoryIds: [],
      createdBy: "",
      status: j.status as Job["status"],
      type: (j.type as Job["type"]) ?? "full_time",
      workplace: (j.workplace as Job["workplace"]) ?? "remote",
      slug: "",
      createdAt: Number(j.updatedAt ?? 0),
      updatedAt: Number(j.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export async function listAllBusinesses(pageSize = 100): Promise<Business[]> {
  const list = await listAdminQueueBusinessesRtdb();
  return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, pageSize);
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

export async function createReport(input: {
  reporterId: string;
  reason: ReportReason;
  targetType: Report["targetType"];
  targetId: string;
  details?: string;
}): Promise<Report> {
  const ts = now();
  const id = isFirebaseConfigured()
    ? doc(collection(getClientFirestore(), "reports")).id
    : `rep_${ts}`;
  const report: Report = {
    id,
    ...input,
    status: "open",
    createdAt: ts,
    updatedAt: ts,
  };
  if (!isFirebaseConfigured()) return report;
  await setDoc(
    doc(getClientFirestore(), "reports", id),
    omitUndefined(report as unknown as Record<string, unknown>),
  );
  return report;
}

export async function listOpenReports(): Promise<Report[]> {
  const reports = await listReportsRtdb();
  return reports.filter((r) => r.status === "open");
}

/** @deprecated Use resolveReportAdmin from admin-server via privileged API. */
export async function resolveReport(_input: {
  reportId: string;
  adminId: string;
  status: Extract<ReportStatus, "resolved" | "dismissed">;
}) {
  throw new Error("Use privileged Admin SDK path (resolveReportAdmin)");
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
