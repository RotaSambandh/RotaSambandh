import { get, ref } from "firebase/database";
import type { Application, ApplicationAnswer, ApplicationStatus } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

export interface ApplicationReadModel {
  id: string;
  jobId: string;
  businessId: string;
  candidateId: string;
  status: ApplicationStatus;
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
}

function mapModel(raw: Record<string, unknown>): ApplicationReadModel {
  return {
    id: String(raw.id ?? ""),
    jobId: String(raw.jobId ?? ""),
    businessId: String(raw.businessId ?? ""),
    candidateId: String(raw.candidateId ?? ""),
    status: (raw.status as ApplicationStatus) ?? "applied",
    submittedAt: Number(raw.submittedAt ?? 0),
    statusUpdatedAt: Number(raw.statusUpdatedAt ?? raw.submittedAt ?? 0),
    jobTitle: String(raw.jobTitle ?? "Opportunity"),
    companyName: String(raw.companyName ?? "Company"),
    companyLogo: String(raw.companyLogo ?? ""),
    companyRemoved: Boolean(raw.companyRemoved),
    candidateName: String(raw.candidateName ?? ""),
    candidateEmail: String(raw.candidateEmail ?? ""),
    candidatePhone: String(raw.candidatePhone ?? ""),
    resumeDocumentId: String(raw.resumeDocumentId ?? ""),
    resumeStorageKey: String(raw.resumeStorageKey ?? ""),
    resumeFileName: String(raw.resumeFileName ?? ""),
  };
}

export async function listCandidateApplicationsRtdb(
  candidateId: string,
): Promise<ApplicationReadModel[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(
      ref(getClientRtdb(), `candidate/${candidateId}/applications`),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val)
      .map(mapModel)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function listEmployerApplicationsRtdb(
  businessId: string,
  jobId?: string,
): Promise<ApplicationReadModel[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(
      ref(getClientRtdb(), `employer/${businessId}/applications`),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val)
      .map(mapModel)
      .filter((a) => (jobId ? a.jobId === jobId : true))
      .sort((a, b) => b.submittedAt - a.submittedAt);
  } catch {
    return [];
  }
}

export async function listApplicationAnswersRtdb(
  businessId: string,
  applicationId: string,
): Promise<ApplicationAnswer[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(
      ref(
        getClientRtdb(),
        `employer/${businessId}/applications/${applicationId}/answers`,
      ),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val).map((a) => ({
      id: String(a.id ?? ""),
      applicationId,
      questionId: String(a.questionId ?? ""),
      questionVersion: Number(a.questionVersion ?? 1),
      promptSnapshot: String(a.promptSnapshot ?? ""),
      type: a.type as ApplicationAnswer["type"],
      value: (a.value ?? null) as ApplicationAnswer["value"],
    }));
  } catch {
    return [];
  }
}

/** Map RTDB read model into Application shape for shared UI helpers. */
export function toApplication(model: ApplicationReadModel): Application {
  return {
    id: model.id,
    jobId: model.jobId,
    businessId: model.businessId,
    candidateId: model.candidateId,
    status: model.status,
    resumeDocumentId: model.resumeDocumentId,
    resumeStorageKey: model.resumeStorageKey,
    resumeFileName: model.resumeFileName,
    submittedAt: model.submittedAt,
    statusUpdatedAt: model.statusUpdatedAt,
    candidateName: model.candidateName,
    candidateEmail: model.candidateEmail,
    candidatePhone: model.candidatePhone,
    companyRemoved: model.companyRemoved,
    companyNameSnapshot: model.companyName,
    jobTitleSnapshot: model.jobTitle,
    createdAt: model.submittedAt,
    updatedAt: model.statusUpdatedAt,
  };
}
