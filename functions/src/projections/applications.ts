import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { READ_MODEL_VERSION } from "../constants";

export interface ApplicationDoc {
  id: string;
  jobId: string;
  businessId: string;
  candidateId: string;
  status: string;
  submittedAt?: number;
  statusUpdatedAt?: number;
  resumeDocumentId?: string;
  resumeStorageKey?: string;
  resumeFileName?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  companyRemoved?: boolean;
  companyNameSnapshot?: string;
  jobTitleSnapshot?: string;
}

export interface ApplicationReadModel {
  id: string;
  jobId: string;
  businessId: string;
  candidateId: string;
  status: string;
  submittedAt: number;
  statusUpdatedAt: number;
  jobTitle: string;
  companyName: string;
  companyLogo: string;
  companyRemoved: boolean;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  resumeDocumentId: string;
  resumeStorageKey: string;
  resumeFileName: string;
  readModelVersion: number;
}

export async function resolveApplicationSnapshots(
  app: ApplicationDoc,
): Promise<{ jobTitle: string; companyName: string; companyLogo: string }> {
  let jobTitle = app.jobTitleSnapshot?.trim() || "";
  let companyName = app.companyNameSnapshot?.trim() || "";
  let companyLogo = "";

  if (!jobTitle || !companyName) {
    try {
      const jobSnap = await getFirestore().doc(`jobs/${app.jobId}`).get();
      if (jobSnap.exists) {
        const job = jobSnap.data() ?? {};
        if (!jobTitle) jobTitle = String(job.title ?? "Opportunity");
      }
    } catch {
      /* ignore */
    }
  }
  if (!companyName || !companyLogo) {
    try {
      const bizSnap = await getFirestore().doc(`businesses/${app.businessId}`).get();
      if (bizSnap.exists) {
        const biz = bizSnap.data() ?? {};
        if (!companyName) companyName = String(biz.name ?? "Company");
        companyLogo = String(biz.logoUrl ?? "");
      }
    } catch {
      /* ignore */
    }
  }

  return {
    jobTitle: jobTitle || "Opportunity",
    companyName: companyName || "Company",
    companyLogo,
  };
}

export function toApplicationReadModel(
  app: ApplicationDoc,
  snaps: { jobTitle: string; companyName: string; companyLogo: string },
): ApplicationReadModel {
  return {
    id: app.id,
    jobId: app.jobId,
    businessId: app.businessId,
    candidateId: app.candidateId,
    status: app.status,
    submittedAt: app.submittedAt ?? Date.now(),
    statusUpdatedAt: app.statusUpdatedAt ?? app.submittedAt ?? Date.now(),
    jobTitle: snaps.jobTitle,
    companyName: snaps.companyName,
    companyLogo: snaps.companyLogo,
    companyRemoved: Boolean(app.companyRemoved),
    candidateName: app.candidateName ?? "",
    candidateEmail: app.candidateEmail ?? "",
    candidatePhone: app.candidatePhone ?? "",
    resumeDocumentId: app.resumeDocumentId ?? "",
    resumeStorageKey: app.resumeStorageKey ?? "",
    resumeFileName: app.resumeFileName ?? "",
    readModelVersion: READ_MODEL_VERSION,
  };
}

export async function projectApplication(app: ApplicationDoc): Promise<ApplicationReadModel> {
  const snaps = await resolveApplicationSnapshots(app);
  const model = toApplicationReadModel(app, snaps);
  const db = getDatabase();
  const updates: Record<string, unknown> = {
    [`candidate/${app.candidateId}/applications/${app.id}`]: model,
    [`employer/${app.businessId}/applications/${app.id}`]: model,
    // Clear legacy thin path
    [`employer/${app.businessId}/recentApplications/${app.id}`]: null,
  };
  await db.ref().update(updates);
  return model;
}

export async function projectApplicationAnswers(
  applicationId: string,
  businessId: string,
  answers: Array<{
    id: string;
    questionId: string;
    questionVersion: number;
    promptSnapshot: string;
    type: string;
    value: unknown;
  }>,
) {
  const db = getDatabase();
  const base = `employer/${businessId}/applications/${applicationId}/answers`;
  const updates: Record<string, unknown> = {};
  for (const a of answers) {
    updates[`${base}/${a.id}`] = {
      id: a.id,
      questionId: a.questionId,
      questionVersion: a.questionVersion,
      promptSnapshot: a.promptSnapshot,
      type: a.type,
      value: a.value ?? null,
      readModelVersion: READ_MODEL_VERSION,
    };
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
}

export async function removeApplicationProjections(app: {
  id: string;
  candidateId: string;
  businessId: string;
}) {
  const db = getDatabase();
  await db.ref().update({
    [`candidate/${app.candidateId}/applications/${app.id}`]: null,
    [`employer/${app.businessId}/applications/${app.id}`]: null,
    [`employer/${app.businessId}/recentApplications/${app.id}`]: null,
  });
}
