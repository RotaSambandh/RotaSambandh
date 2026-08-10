import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { createDownloadUrl, isR2Configured } from "@/lib/r2/client";
import { toCsv } from "@/lib/csv/to-csv";
import { isPlatformStaff } from "@/shared/rbac";
import type {
  Application,
  ApplicationAnswer,
  ApplicationEvent,
  BusinessMember,
  Job,
  UserRole,
} from "@/shared/types";

export const runtime = "nodejs";

function formatAnswerValue(value: ApplicationAnswer["value"]): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

async function assertCanExportJob(
  uid: string,
  roles: UserRole[],
  businessId: string,
): Promise<boolean> {
  if (isPlatformStaff(roles)) return true;
  const memberId = `${businessId}_${uid}`;
  const snap = await getAdminFirestore().collection("businessMembers").doc(memberId).get();
  if (!snap.exists) return false;
  const member = snap.data() as BusinessMember;
  return member.userId === uid && (!member.status || member.status === "active");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.suspended) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await context.params;
  const db = getAdminFirestore();
  const jobSnap = await db.collection("jobs").doc(jobId).get();
  if (!jobSnap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const job = { id: jobSnap.id, ...jobSnap.data() } as Job;

  const allowed = await assertCanExportJob(session.uid, session.roles, job.businessId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const appsSnap = await db.collection("applications").where("jobId", "==", jobId).get();
  const applications = appsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Application)
    .filter((a) => a.businessId === job.businessId)
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));

  const answersByApp = new Map<string, ApplicationAnswer[]>();
  const notesByApp = new Map<string, string[]>();

  for (let i = 0; i < applications.length; i += 10) {
    const chunk = applications.slice(i, i + 10);
    const ids = chunk.map((a) => a.id);
    const [answersSnap, eventsSnap] = await Promise.all([
      db.collection("applicationAnswers").where("applicationId", "in", ids).get(),
      db.collection("applicationEvents").where("applicationId", "in", ids).get(),
    ]);
    for (const doc of answersSnap.docs) {
      const answer = { id: doc.id, ...doc.data() } as ApplicationAnswer;
      const list = answersByApp.get(answer.applicationId) ?? [];
      list.push(answer);
      answersByApp.set(answer.applicationId, list);
    }
    for (const doc of eventsSnap.docs) {
      const event = { id: doc.id, ...doc.data() } as ApplicationEvent;
      if (!event.note?.trim()) continue;
      const list = notesByApp.get(event.applicationId) ?? [];
      list.push(event.note.trim());
      notesByApp.set(event.applicationId, list);
    }
  }

  const promptSet = new Set<string>();
  for (const answers of answersByApp.values()) {
    for (const a of answers) {
      if (a.promptSnapshot?.trim()) promptSet.add(a.promptSnapshot.trim());
    }
  }
  const questionPrompts = Array.from(promptSet);

  const canSign = isR2Configured();
  const resumeUrls = new Map<string, string>();
  if (canSign) {
    await Promise.all(
      applications.map(async (app) => {
        if (!app.resumeStorageKey) return;
        try {
          // 7-day links so the CSV stays useful offline for a work week.
          const url = await createDownloadUrl(app.resumeStorageKey, 60 * 60 * 24 * 7);
          resumeUrls.set(app.id, url);
        } catch {
          // leave empty
        }
      }),
    );
  }

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Status",
    "Submitted at",
    "Resume file",
    "Resume link",
    "Notes",
    ...questionPrompts,
  ];

  const rows = applications.map((app) => {
    const answers = answersByApp.get(app.id) ?? [];
    const byPrompt = new Map(
      answers.map((a) => [a.promptSnapshot?.trim() ?? "", formatAnswerValue(a.value)]),
    );
    return [
      app.candidateName ?? "",
      app.candidateEmail ?? "",
      app.candidatePhone ?? "",
      app.status,
      app.submittedAt ? new Date(app.submittedAt).toISOString() : "",
      app.resumeFileName ?? "",
      resumeUrls.get(app.id) ?? "",
      (notesByApp.get(app.id) ?? []).join(" | "),
      ...questionPrompts.map((prompt) => byPrompt.get(prompt) ?? ""),
    ];
  });

  const csv = toCsv(headers, rows);
  const safeTitle = (job.title || "job")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
  const filename = `${safeTitle}_applicants.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
