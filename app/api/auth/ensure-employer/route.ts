import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminAuth, getAdminFirestore, getAdminRtdb } from "@/lib/firebase/admin";
import type { BusinessMember, UserRole } from "@/shared/types";

/** Grant employer role and claim any pending company invites for this Google email. */
export async function POST(request: Request) {
  let uid: string | null = null;
  let email = "";
  let displayName = "";
  try {
    const body = (await request.json().catch(() => ({}))) as { idToken?: string };
    if (body.idToken) {
      const decoded = await getAdminAuth().verifyIdToken(body.idToken);
      uid = decoded.uid;
      email = (decoded.email ?? "").toLowerCase();
      displayName = (decoded.name as string | undefined) ?? email;
    } else {
      const session = await getSessionUser();
      uid = session?.uid ?? null;
      email = (session?.email ?? "").toLowerCase();
      displayName = session?.displayName ?? email;
    }
  } catch {
    uid = null;
  }

  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const ts = Date.now();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    const existing = (snap.data()?.roles as UserRole[] | undefined) ?? ["candidate"];
    const roles = Array.from(new Set([...existing, "employer", "candidate"])) as UserRole[];
    await ref.set(
      {
        roles,
        email: email || snap.data()?.email,
        displayName: displayName || snap.data()?.displayName,
        updatedAt: ts,
      },
      { merge: true },
    );
    await getAdminAuth().setCustomUserClaims(uid, { roles });

    if (email) {
      const invites = await db
        .collection("businessMembers")
        .where("email", "==", email)
        .limit(20)
        .get();

      const rtdb = getAdminRtdb();
      for (const doc of invites.docs) {
        const invite = doc.data() as BusinessMember;
        if (invite.status !== "invited") continue;
        const memberId = `${invite.businessId}_${uid}`;
        const member: BusinessMember = {
          ...invite,
          id: memberId,
          userId: uid,
          email,
          displayName: displayName || invite.displayName,
          status: "active",
          updatedAt: ts,
        };
        await db.collection("businessMembers").doc(memberId).set(member, { merge: true });
        if (doc.id !== memberId) {
          await doc.ref.delete();
        }
        await rtdb.ref(`employerMembers/${invite.businessId}/${uid}`).set(true);
      }
    }

    return NextResponse.json({ roles });
  } catch {
    return NextResponse.json({ error: "Unable to update roles" }, { status: 500 });
  }
}
