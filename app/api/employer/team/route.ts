import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminAuth, getAdminFirestore, getAdminRtdb } from "@/lib/firebase/admin";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import type { BusinessMember, UserRole } from "@/shared/types";

async function assertCompanyAdmin(businessId: string, uid: string) {
  const snap = await getAdminFirestore()
    .collection("businessMembers")
    .doc(`${businessId}_${uid}`)
    .get();
  if (!snap.exists) throw new Error("Not a business member");
  const member = snap.data() as BusinessMember;
  if (normalizeBusinessMemberRole(member.role) !== "company_admin") {
    throw new Error("Only company admins can manage the team");
  }
  if (member.status === "revoked") throw new Error("Membership revoked");
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    action: "invite" | "revoke";
    businessId?: string;
    email?: string;
    userId?: string;
    displayName?: string;
    role?: "manager" | "company_admin";
  };

  const businessId = String(body.businessId ?? "");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  try {
    await assertCompanyAdmin(businessId, session.uid);
    const db = getAdminFirestore();
    const bizSnap = await db.collection("businesses").doc(businessId).get();
    if (!bizSnap.exists) throw new Error("Business not found");
    if (bizSnap.data()?.status === "deletion_pending") {
      throw new Error("Company is pending deletion; team changes are blocked");
    }
    const ts = Date.now();

    if (body.action === "invite") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const role = body.role === "company_admin" ? "company_admin" : "manager";

      const users = await db.collection("users").where("email", "==", email).limit(1).get();
      let userId: string;
      if (!users.empty) {
        userId = users.docs[0]!.id;
        const existing = users.docs[0]!.data();
        const roles = Array.from(
          new Set([...(existing.roles as UserRole[] | undefined) ?? [], "employer", "candidate"]),
        ) as UserRole[];
        await db.collection("users").doc(userId).set({ roles, updatedAt: ts }, { merge: true });
        await getAdminAuth().setCustomUserClaims(userId, { roles });
      } else {
        userId = `invite_${email.replace(/[^a-z0-9]/gi, "_")}`;
      }

      const memberId = `${businessId}_${userId}`;
      const member: BusinessMember = {
        id: memberId,
        businessId,
        userId,
        role,
        email,
        displayName: body.displayName ?? (users.empty ? undefined : String(users.docs[0]!.data().displayName ?? "")),
        invitedBy: session.uid,
        status: users.empty ? "invited" : "active",
        createdAt: ts,
        updatedAt: ts,
      };
      await db.collection("businessMembers").doc(memberId).set(member, { merge: true });
      // RTDB employerMembers is maintained by onBusinessMemberWritten (active only).
      return NextResponse.json({ ok: true, member });
    }

    if (body.action === "revoke") {
      const userId = String(body.userId ?? "");
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      if (userId === session.uid) {
        return NextResponse.json({ error: "Cannot revoke yourself" }, { status: 400 });
      }
      await db
        .collection("businessMembers")
        .doc(`${businessId}_${userId}`)
        .set({ status: "revoked", updatedAt: ts }, { merge: true });
      // Clear RTDB mirror immediately (function also handles this on write).
      await getAdminRtdb().ref(`employerMembers/${businessId}/${userId}`).remove();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 403 },
    );
  }
}
