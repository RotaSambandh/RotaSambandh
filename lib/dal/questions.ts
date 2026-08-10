import { collection, doc, setDoc } from "firebase/firestore";
import type { JobQuestion, Question, QuestionScope, QuestionType } from "@/shared/types";
import {
  getClientFirestore,
  getClientRtdb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { now, omitUndefined } from "@/lib/utils";
import { getQuestionRtdb, listQuestionsRtdb } from "@/lib/dal/admin-rtdb";
import { get, ref } from "firebase/database";

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
  const all = await listQuestionsRtdb();
  const platform = all.filter((q) => q.scope === "platform" && q.active);
  return platform.length ? platform : platformDefaults;
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
  await setDoc(
    doc(getClientFirestore(), "questions", id),
    omitUndefined(question as unknown as Record<string, unknown>),
  );
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

  let existing = (await getQuestionRtdb(id)) ?? undefined;
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

export async function listJobQuestions(
  jobId: string,
  businessId?: string,
): Promise<Question[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const paths = [
      businessId
        ? `employer/${businessId}/jobs/${jobId}/questionLinks`
        : null,
      `jobs/${jobId}/questionLinks`,
    ].filter(Boolean) as string[];

    let links: Array<{
      questionId: string;
      sortOrder?: number;
      required?: boolean;
    }> = [];

    for (const path of paths) {
      const snap = await get(ref(getClientRtdb(), path));
      if (!snap.exists()) continue;
      links = Object.values(
        snap.val() as Record<
          string,
          { questionId: string; sortOrder?: number; required?: boolean }
        >,
      );
      if (links.length) break;
    }

    if (!links.length) return platformDefaults.slice(0, 3);
    links.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const questions: Question[] = [];
    for (const link of links) {
      const q = await getQuestionRtdb(link.questionId);
      if (q) questions.push({ ...q, required: link.required ?? q.required });
    }
    return questions.length ? questions : platformDefaults.slice(0, 3);
  } catch {
    return platformDefaults.slice(0, 3);
  }
}
