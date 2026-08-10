import { doc, setDoc, updateDoc } from "firebase/firestore";
import { get, ref } from "firebase/database";
import type { DocumentMeta } from "@/shared/types";
import {
  getClientFirestore,
  getClientRtdb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { now } from "@/lib/utils";

export async function createDocumentMeta(input: Omit<DocumentMeta, "createdAt" | "updatedAt">) {
  const ts = now();
  const meta: DocumentMeta = { ...input, createdAt: ts, updatedAt: ts };
  if (!isFirebaseConfigured()) return meta;
  await setDoc(doc(getClientFirestore(), "documents", input.id), meta);
  if (input.isPrimary && input.kind === "resume") {
    await updateDoc(doc(getClientFirestore(), "candidateProfiles", input.candidateId), {
      primaryResumeId: input.id,
      updatedAt: ts,
    }).catch(() => undefined);
  }
  return meta;
}

/** UI list reads from RTDB `candidate/{uid}/documents` (Functions mirror). */
export async function listCandidateDocuments(candidateId: string): Promise<DocumentMeta[]> {
  if (!isFirebaseConfigured()) {
    return [
      {
        id: "doc_demo",
        candidateId,
        fileName: "resume.pdf",
        storageKey: `resumes/${candidateId}/doc_demo/resume.pdf`,
        mimeType: "application/pdf",
        fileSize: 120000,
        isPrimary: true,
        kind: "resume",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }
  try {
    const snap = await get(
      ref(getClientRtdb(), `candidate/${candidateId}/documents`),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val).map((d) => ({
      id: String(d.id ?? ""),
      candidateId,
      fileName: String(d.fileName ?? ""),
      storageKey: String(d.storageKey ?? ""),
      mimeType: String(d.mimeType ?? ""),
      fileSize: Number(d.fileSize ?? 0),
      isPrimary: Boolean(d.isPrimary),
      kind: (d.kind as DocumentMeta["kind"]) ?? "resume",
      createdAt: Number(d.createdAt ?? 0),
      updatedAt: Number(d.updatedAt ?? 0),
    }));
  } catch {
    return [];
  }
}
