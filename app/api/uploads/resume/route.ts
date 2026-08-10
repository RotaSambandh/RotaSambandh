import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ALLOWED_RESUME_MIME, MAX_RESUME_BYTES } from "@/shared/constants";
import { buildResumeKey, createUploadUrl, isR2Configured } from "@/lib/r2/client";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    fileName?: string;
    contentType?: string;
    contentLength?: number;
    candidateId?: string;
  };

  if (!body.fileName || !body.contentType || !body.contentLength || !body.candidateId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.candidateId !== session.uid) {
    return NextResponse.json({ error: "candidateId must match session" }, { status: 403 });
  }

  if (!ALLOWED_RESUME_MIME.includes(body.contentType as (typeof ALLOWED_RESUME_MIME)[number])) {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }
  if (body.contentLength > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Resume must be 2 MB or smaller" }, { status: 400 });
  }
  if (session.suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const documentId = randomUUID();
  const storageKey = buildResumeKey(session.uid, documentId, body.fileName);
  const uploadUrl = await createUploadUrl({
    key: storageKey,
    contentType: body.contentType,
    contentLength: body.contentLength,
  });

  return NextResponse.json({ uploadUrl, documentId, storageKey });
}
