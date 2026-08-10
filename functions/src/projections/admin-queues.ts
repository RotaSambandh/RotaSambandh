import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";

export async function projectAdminQueueItem(
  queue: "verifications" | "jobs" | "reports" | "businesses" | "users",
  id: string,
  payload: Record<string, unknown> | null,
) {
  const ref = getDatabase().ref(`admin/queues/${queue}/${id}`);
  if (!payload) {
    await ref.remove();
    return;
  }
  await ref.set({
    ...payload,
    id,
    readModelVersion: READ_MODEL_VERSION,
  });
}

export async function projectTaxonomyDoc(
  kind: "categories" | "skills" | "questions",
  id: string,
  data: Record<string, unknown> | null,
) {
  const ref = getDatabase().ref(`system/taxonomy/${kind}/${id}`);
  if (!data) {
    await ref.remove();
    return;
  }
  await ref.set({
    ...data,
    id,
    readModelVersion: READ_MODEL_VERSION,
  });
}

export async function projectJobQuestions(
  jobId: string,
  businessId: string,
  links: Array<{
    id: string;
    questionId: string;
    sortOrder: number;
    required: boolean;
  }>,
) {
  const db = getDatabase();
  const updates: Record<string, unknown> = {
    [`employer/${businessId}/jobs/${jobId}/questionLinks`]: null,
  };
  for (const link of links) {
    updates[`employer/${businessId}/jobs/${jobId}/questionLinks/${link.id}`] = {
      ...link,
      readModelVersion: READ_MODEL_VERSION,
    };
    updates[`jobs/${jobId}/questionLinks/${link.id}`] = {
      ...link,
      readModelVersion: READ_MODEL_VERSION,
    };
  }
  await db.ref().update(updates);
}
