import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";

export async function projectCandidateDocument(
  candidateId: string,
  id: string,
  data: Record<string, unknown> | null,
) {
  const ref = getDatabase().ref(`candidate/${candidateId}/documents/${id}`);
  if (!data) {
    await ref.remove();
    return;
  }
  await ref.set({
    id,
    candidateId,
    fileName: data.fileName ?? "",
    storageKey: data.storageKey ?? "",
    mimeType: data.mimeType ?? "",
    fileSize: data.fileSize ?? 0,
    isPrimary: Boolean(data.isPrimary),
    kind: data.kind ?? "resume",
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt ?? Date.now(),
    readModelVersion: READ_MODEL_VERSION,
  });
}
