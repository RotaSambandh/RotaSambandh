import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requestBusinessDeletion } from "@/lib/admin/business-deletion";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import type { BusinessMember } from "@/shared/types";

async function assertCompanyAdmin(businessId: string, uid: string) {
  const snap = await getAdminFirestore()
    .collection("businessMembers")
    .doc(`${businessId}_${uid}`)
    .get();
  if (!snap.exists) throw new Error("Not a business member");
  const member = snap.data() as BusinessMember;
  if (normalizeBusinessMemberRole(member.role) !== "company_admin") {
    throw new Error("Only company admins can request company deletion");
  }
  if (member.status === "revoked") throw new Error("Membership revoked");
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    businessId?: string;
    confirmName?: string;
  };

  const businessId = String(body.businessId ?? "").trim();
  const confirmName = String(body.confirmName ?? "");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
  if (!confirmName.trim()) {
    return NextResponse.json({ error: "Type the company name to confirm" }, { status: 400 });
  }

  try {
    await assertCompanyAdmin(businessId, session.uid);
    await requestBusinessDeletion({
      businessId,
      requestedBy: session.uid,
      confirmName,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message.includes("Only company") || message.includes("Not a business") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
