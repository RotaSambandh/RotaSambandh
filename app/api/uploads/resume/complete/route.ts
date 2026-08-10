import { NextResponse } from "next/server";
import { createDocumentMetaAdmin } from "@/lib/dal/admin-server";
import { getSessionUser } from "@/lib/auth/session";
import { ALLOWED_RESUME_MIME, MAX_RESUME_BYTES } from "@/shared/constants";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  const body = (await request.json()) as {
    documentId?: string;
    candidateId?: string;
    fileName?: string;
    storageKey?: string;
    mimeType?: string;
    fileSize?: number;
    isPrimary?: boolean;
  };

  if (
    !body.documentId ||
    !body.candidateId ||
    !body.fileName ||
    !body.storageKey ||
    !body.mimeType ||
    typeof body.fileSize !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.candidateId !== session.uid) {
    return NextResponse.json({ error: "candidateId must match session" }, { status: 403 });
  }

  if (!body.storageKey.startsWith(`resumes/${session.uid}/`)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 403 });
  }

  if (!ALLOWED_RESUME_MIME.includes(body.mimeType as (typeof ALLOWED_RESUME_MIME)[number])) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  if (body.fileSize <= 0 || body.fileSize > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Resume must be 2 MB or smaller" }, { status: 400 });
  }

  const meta = await createDocumentMetaAdmin({
    id: body.documentId,
    candidateId: body.candidateId,
    fileName: body.fileName,
    storageKey: body.storageKey,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
    isPrimary: body.isPrimary ?? false,
    kind: "resume",
  });

  return NextResponse.json({ document: meta });
}
