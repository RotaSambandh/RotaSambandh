import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { publicLogoUrl } from "@/lib/r2/client";

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
    storageKey?: string;
    publicUrl?: string;
  };

  if (!body.businessId || !body.storageKey) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!(await assertBusinessMember(session.uid, body.businessId))) {
    return NextResponse.json({ error: "Not a member of this business" }, { status: 403 });
  }

  if (!body.storageKey.startsWith(`logos/${body.businessId}/`)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  const url = body.publicUrl || publicLogoUrl(body.storageKey);
  return NextResponse.json({ publicUrl: url, storageKey: body.storageKey });
}
