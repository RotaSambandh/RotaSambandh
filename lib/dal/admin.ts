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
} from "firebase/firestore";
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
import { ADMIN_PAGE_SIZE } from "@/shared/constants";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now } from "@/lib/utils";

async function logAdminAction(input: Omit<AdminAction, "id" | "createdAt" | "updatedAt">) {
  if (!isFirebaseConfigured()) return;
  const ts = now();
  const ref = doc(collection(getClientFirestore(), "adminActions"));
  await setDoc(ref, { ...input, id: ref.id, createdAt: ts, updatedAt: ts });
}

export async function listPendingVerifications(): Promise<BusinessVerification[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "businessVerifications"),
    where("status", "==", "pending"),
    orderBy("updatedAt", "desc"),
    limit(ADMIN_PAGE_SIZE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as BusinessVerification);
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
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "jobs"),
    where("status", "==", "pending_review"),
    orderBy("updatedAt", "desc"),
    limit(ADMIN_PAGE_SIZE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Job);
}

export async function listAllJobs(pageSize = 100): Promise<Job[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "jobs"),
    orderBy("updatedAt", "desc"),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Job);
}

export async function getAdminJob(jobId: string): Promise<Job | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "jobs", jobId));
  return snap.exists() ? (snap.data() as Job) : null;
}

export async function listAllBusinesses(pageSize = 100): Promise<Business[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "businesses"),
    orderBy("updatedAt", "desc"),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Business);
}

export async function getAdminBusiness(businessId: string): Promise<Business | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "businesses", businessId));
  return snap.exists() ? (snap.data() as Business) : null;
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
  // Client-callable path kept for legacy UI; prefer privileged Admin SDK for production ops.
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
  await setDoc(doc(getClientFirestore(), "reports", id), report);
  return report;
}

export async function listOpenReports(): Promise<Report[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "reports"),
    where("status", "==", "open"),
    orderBy("updatedAt", "desc"),
    limit(ADMIN_PAGE_SIZE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Report);
}

/** @deprecated Use resolveReportAdmin from admin-server via privileged API. */
export async function resolveReport(_input: {
  reportId: string;
  adminId: string;
  status: Extract<ReportStatus, "resolved" | "dismissed">;
}) {
  throw new Error("Use privileged Admin SDK path (resolveReportAdmin)");
}

export async function listBusinessesByStatus(status: Business["status"]): Promise<Business[]> {
  if (!isFirebaseConfigured()) return [];
  const q = query(
    collection(getClientFirestore(), "businesses"),
    where("status", "==", status),
    orderBy("updatedAt", "desc"),
    limit(ADMIN_PAGE_SIZE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Business);
}

export async function searchUsers(emailPrefix: string): Promise<UserDoc[]> {
  if (!isFirebaseConfigured() || !emailPrefix.trim()) return [];
  const q = query(
    collection(getClientFirestore(), "users"),
    where("email", ">=", emailPrefix.toLowerCase()),
    where("email", "<=", `${emailPrefix.toLowerCase()}\uf8ff`),
    limit(ADMIN_PAGE_SIZE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserDoc);
}
