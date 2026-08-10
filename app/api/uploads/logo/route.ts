import { NextResponse } from "next/server";
import { ALLOWED_LOGO_MIME, MAX_LOGO_BYTES } from "@/shared/constants";
import {
  buildLogoKey,
  createLogoUploadUrl,
  isR2LogosConfigured,
  publicLogoUrl,
} from "@/lib/r2/client";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminFirestore } from "@/lib/firebase/admin";

async function assertBusinessMember(uid: string, businessId: string): Promise<boolean> {
  const snap = await getAdminFirestore().collection("businessMembers").doc(`${businessId}_${uid}`).get();
  if (!snap.exists) return false;
  const data = snap.data();
  const status = (data?.status as string | undefined) ?? "active";
  return status === "active";
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    businessId?: string;
    fileName?: string;
    contentType?: string;
    contentLength?: number;
  };

  if (!body.businessId || !body.fileName || !body.contentType || !body.contentLength) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!(await assertBusinessMember(session.uid, body.businessId))) {
    return NextResponse.json({ error: "Not a member of this business" }, { status: 403 });
  }

  if (!ALLOWED_LOGO_MIME.includes(body.contentType as (typeof ALLOWED_LOGO_MIME)[number])) {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }
  if (body.contentLength > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be 1 MB or smaller" }, { status: 400 });
  }

  if (!isR2LogosConfigured()) {
    return NextResponse.json({ error: "Logo storage not configured" }, { status: 503 });
  }

  const storageKey = buildLogoKey(body.businessId, body.fileName);
  const uploadUrl = await createLogoUploadUrl({
    key: storageKey,
    contentType: body.contentType,
    contentLength: body.contentLength,
  });

  return NextResponse.json({
    uploadUrl,
    storageKey,
    publicUrl: publicLogoUrl(storageKey),
  });
}
