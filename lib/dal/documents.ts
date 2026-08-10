import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import type { DocumentMeta } from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
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
  const q = query(
    collection(getClientFirestore(), "documents"),
    where("candidateId", "==", candidateId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DocumentMeta);
}
