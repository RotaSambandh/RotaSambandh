import { NextResponse } from "next/server";
import { createDownloadUrl, isR2Configured } from "@/lib/r2/client";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isPlatformStaff } from "@/shared/rbac";
import type { Application, BusinessMember } from "@/shared/types";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    storageKey?: string;
    applicationId?: string;
  };

  if (!body.storageKey || !body.applicationId) {
    return NextResponse.json({ error: "Missing storageKey or applicationId" }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const db = getAdminFirestore();
  const appSnap = await db.collection("applications").doc(body.applicationId).get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const app = appSnap.data() as Application;
  if (app.resumeStorageKey !== body.storageKey) {
    return NextResponse.json({ error: "storageKey mismatch" }, { status: 403 });
  }

  const uid = session.uid;
  const isCandidate = uid === app.candidateId;
  const isStaff = isPlatformStaff(session.roles);
  let isEmployer = false;
  if (!isCandidate && !isStaff) {
    const memberId = `${app.businessId}_${uid}`;
    const memberSnap = await db.collection("businessMembers").doc(memberId).get();
    isEmployer =
      memberSnap.exists &&
      (memberSnap.data() as BusinessMember).userId === uid &&
      (memberSnap.data() as BusinessMember).status === "active";
  }

  if (!isCandidate && !isEmployer && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await createDownloadUrl(body.storageKey, 120);
  return NextResponse.json({ url, applicationId: body.applicationId });
}
