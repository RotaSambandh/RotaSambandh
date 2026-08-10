import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy,
} from "firebase/firestore";
import type { JobQuestion, Question, QuestionScope, QuestionType } from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, omitUndefined } from "@/lib/utils";

const platformDefaults: Question[] = [
  {
    id: "q_location",
    scope: "platform",
    type: "short_text",
    prompt: "What is your current location?",
    version: 1,
    required: true,
    active: true,
    platformKey: "current_location",
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "q_experience",
    scope: "platform",
    type: "number",
    prompt: "How many years of relevant professional experience do you have?",
    version: 1,
    required: true,
    active: true,
    platformKey: "years_experience",
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "q_notice",
    scope: "platform",
    type: "short_text",
    prompt: "What is your notice period?",
    version: 1,
    required: false,
    active: true,
    platformKey: "notice_period",
    createdAt: 0,
    updatedAt: 0,
  },
];

export async function listPlatformQuestions(): Promise<Question[]> {
  if (!isFirebaseConfigured()) return platformDefaults;
  const q = query(
    collection(getClientFirestore(), "questions"),
    where("scope", "==", "platform"),
    where("active", "==", true),
  );
  const snap = await getDocs(q);
  if (snap.empty) return platformDefaults;
  return snap.docs.map((d) => d.data() as Question);
}

export async function createQuestion(input: {
  scope: QuestionScope;
  type: QuestionType;
  prompt: string;
  required?: boolean;
  options?: string[];
  businessId?: string;
  jobId?: string;
  platformKey?: string;
}): Promise<Question> {
  const ts = now();
  const id = isFirebaseConfigured()
    ? doc(collection(getClientFirestore(), "questions")).id
    : `q_${ts}`;

  const question: Question = {
    id,
    scope: input.scope,
    businessId: input.businessId,
    jobId: input.jobId,
    type: input.type,
    prompt: input.prompt,
    version: 1,
    options: input.options,
    required: input.required ?? false,
    active: true,
    platformKey: input.platformKey,
    createdAt: ts,
    updatedAt: ts,
  };

  if (!isFirebaseConfigured()) return question;
  await setDoc(doc(getClientFirestore(), "questions", id), question);
  return question;
}

export async function updatePlatformQuestion(
  id: string,
  patch: {
    prompt?: string;
    type?: QuestionType;
    required?: boolean;
    platformKey?: string;
    active?: boolean;
  },
): Promise<Question> {
  const ts = now();
  const defaultsById = new Map(platformDefaults.map((q) => [q.id, q]));

  let existing: Question | undefined;
  if (isFirebaseConfigured()) {
    const snap = await getDoc(doc(getClientFirestore(), "questions", id));
    if (snap.exists()) existing = snap.data() as Question;
  }
  existing ??= defaultsById.get(id);

  if (!existing) {
    throw new Error("Question not found");
  }

  const nextPrompt = patch.prompt?.trim() ?? existing.prompt;
  const promptChanged = nextPrompt !== existing.prompt;
  const nextType = patch.type ?? existing.type;
  const typeChanged = nextType !== existing.type;

  const updated: Question = {
    ...existing,
    prompt: nextPrompt,
    type: nextType,
    required: patch.required ?? existing.required,
    platformKey: patch.platformKey?.trim() || existing.platformKey,
    active: patch.active ?? existing.active,
    version: promptChanged || typeChanged ? existing.version + 1 : existing.version,
    updatedAt: ts,
    createdAt: existing.createdAt || ts,
  };

  if (!isFirebaseConfigured()) return updated;
  await setDoc(
    doc(getClientFirestore(), "questions", id),
    omitUndefined(updated as unknown as Record<string, unknown>),
    { merge: true },
  );
  return updated;
}

export async function attachQuestionsToJob(
  jobId: string,
  items: Array<{ questionId: string; questionVersion: number; required: boolean }>,
) {
  if (!isFirebaseConfigured()) return;
  const db = getClientFirestore();
  await Promise.all(
    items.map((item, index) => {
      const id = `${jobId}_${item.questionId}`;
      const payload: JobQuestion = {
        jobId,
        questionId: item.questionId,
        questionVersion: item.questionVersion,
        order: index,
        required: item.required,
      };
      return setDoc(doc(db, "jobQuestions", id), payload);
    }),
  );
}

export async function listJobQuestions(jobId: string): Promise<Question[]> {
  if (!isFirebaseConfigured()) return [];
  const jq = await getDocs(
    query(
      collection(getClientFirestore(), "jobQuestions"),
      where("jobId", "==", jobId),
      orderBy("order"),
    ),
  );
  if (jq.empty) return platformDefaults.slice(0, 3);
  const links = jq.docs.map((d) => d.data() as JobQuestion);
  const ids = links.map((l) => l.questionId);
  const byId = new Map<string, Question>();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const snap = await getDocs(
      query(collection(getClientFirestore(), "questions"), where(documentId(), "in", chunk)),
    );
    snap.docs.forEach((d) => byId.set(d.id, d.data() as Question));
  }
  return links.map((l) => byId.get(l.questionId)).filter(Boolean) as Question[];
}
