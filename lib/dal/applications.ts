import {
  collection,
  doc,
  writeBatch,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import type {
  Application,
  ApplicationAnswer,
  ApplicationStatus,
  Business,
  Job,
  QuestionType,
} from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now } from "@/lib/utils";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";
import { assertBusinessAcceptsMutations } from "@/lib/dal/business-guards";
import {
  listApplicationAnswersRtdb,
  listCandidateApplicationsRtdb,
  listEmployerApplicationsRtdb,
  toApplication,
} from "@/lib/dal/applications-rtdb";

export interface SubmitApplicationInput {
  jobId: string;
  businessId: string;
  candidateId: string;
  resumeDocumentId: string;
  resumeStorageKey: string;
  resumeFileName: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  answers: Array<{
    questionId: string;
    questionVersion: number;
    promptSnapshot: string;
    type: QuestionType;
    value: string | string[] | number | boolean | null;
  }>;
}

export async function submitApplication(input: SubmitApplicationInput): Promise<string> {
  if (!isFirebaseConfigured()) {
    return `app_demo_${Date.now()}`;
  }

  const db = getClientFirestore();
  const jobSnap = await getDoc(doc(db, "jobs", input.jobId));
  if (!jobSnap.exists()) {
    throw new Error("This opportunity is no longer available.");
  }
  const job = jobSnap.data() as Job;
  if (job.status !== "published") {
    throw new Error("This opportunity is not open for applications.");
  }
  if (!isJobOpenForApplications(job)) {
    throw new Error("The application deadline for this opportunity has passed.");
  }
  if (job.businessId !== input.businessId) {
    throw new Error("Invalid application payload.");
  }

  const bizSnap = await getDoc(doc(db, "businesses", input.businessId));
  if (!bizSnap.exists()) {
    throw new Error("This opportunity is no longer available.");
  }
  assertBusinessAcceptsMutations(bizSnap.data() as Business);

  const phone = input.candidatePhone.trim();
  if (!phone) {
    throw new Error("Phone number is required to apply.");
  }

  const appRef = doc(collection(db, "applications"));
  const batch = writeBatch(db);
  const ts = now();

  const application: Application = {
    id: appRef.id,
    jobId: input.jobId,
    businessId: input.businessId,
    candidateId: input.candidateId,
    status: "applied",
    resumeDocumentId: input.resumeDocumentId,
    resumeStorageKey: input.resumeStorageKey,
    resumeFileName: input.resumeFileName,
    candidateName: input.candidateName.trim(),
    candidateEmail: input.candidateEmail.trim(),
    candidatePhone: phone,
    jobTitleSnapshot: job.title,
    companyNameSnapshot: (bizSnap.data() as Business).name,
    submittedAt: ts,
    statusUpdatedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };

  batch.set(appRef, application);

  for (const answer of input.answers) {
    const answerRef = doc(collection(db, "applicationAnswers"));
    const payload: ApplicationAnswer = {
      id: answerRef.id,
      applicationId: appRef.id,
      ...answer,
    };
    batch.set(answerRef, payload);
  }

  const eventRef = doc(collection(db, "applicationEvents"));
  batch.set(eventRef, {
    id: eventRef.id,
    applicationId: appRef.id,
    toStatus: "applied" satisfies ApplicationStatus,
    actorId: input.candidateId,
    createdAt: ts,
    updatedAt: ts,
  });

  await batch.commit();
  return appRef.id;
}

export async function listCandidateApplications(candidateId: string): Promise<Application[]> {
  const rows = await listCandidateApplicationsRtdb(candidateId);
  return rows.map(toApplication);
}

/** @deprecated Prefer listEmployerApplicationsRtdb — kept for callers that still use pagination shape. */
export async function listJobApplicationsPage(input: {
  jobId: string;
  businessId?: string;
}): Promise<{ items: Application[]; nextCursor: null }> {
  if (!input.businessId) {
    return { items: [], nextCursor: null };
  }
  const rows = await listEmployerApplicationsRtdb(input.businessId, input.jobId);
  return { items: rows.map(toApplication), nextCursor: null };
}

export async function updateApplicationStatus(input: {
  applicationId: string;
  actorId: string;
  toStatus: ApplicationStatus;
  note?: string;
}) {
  if (!isFirebaseConfigured()) return;

  const db = getClientFirestore();
  const appRef = doc(db, "applications", input.applicationId);
  const current = await getDoc(appRef);
  if (!current.exists()) throw new Error("Application not found");
  const data = current.data() as Application;
  if (data.companyRemoved) {
    throw new Error("This application belongs to a removed company and cannot be updated.");
  }
  const bizSnap = await getDoc(doc(db, "businesses", data.businessId));
  if (bizSnap.exists()) {
    assertBusinessAcceptsMutations(bizSnap.data() as Business);
  }
  const ts = now();

  await updateDoc(appRef, {
    status: input.toStatus,
    statusUpdatedAt: ts,
    updatedAt: ts,
  });

  const eventRef = doc(collection(db, "applicationEvents"));
  const batch = writeBatch(db);
  batch.set(eventRef, {
    id: eventRef.id,
    applicationId: input.applicationId,
    fromStatus: data.status,
    toStatus: input.toStatus,
    actorId: input.actorId,
    note: input.note,
    createdAt: ts,
    updatedAt: ts,
  });
  await batch.commit();
}

export async function listApplicationAnswers(
  applicationId: string,
  businessId?: string,
): Promise<ApplicationAnswer[]> {
  if (!businessId) return [];
  return listApplicationAnswersRtdb(businessId, applicationId);
}
