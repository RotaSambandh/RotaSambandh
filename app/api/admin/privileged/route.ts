import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminAuth, getAdminFirestore, getAdminRtdb } from "@/lib/firebase/admin";
import {
  assertPlatformAdmin,
  assertSuperAdmin,
} from "@/lib/auth/rbac-server";
import type { UserRole } from "@/shared/types";
import { PLATFORM_STAFF_ROLES } from "@/shared/rbac";
import { slugify } from "@/lib/utils";
import {
  mergeChangeRequestAdmin,
  moderateJobAdmin,
  reviewVerificationAdmin,
  setUserSuspendedAdmin,
} from "@/lib/dal/admin-server";
import {
  purgeBusiness,
  restoreBusinessDeletion,
} from "@/lib/admin/business-deletion";
import { countAnnouncementAudience, sendAnnouncement } from "@/lib/admin/announcements";

export async function POST(request: Request) {
  const user = await getSessionUser();

  const body = (await request.json()) as {
    action: string;
    payload: Record<string, string | undefined>;
  };

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminId = user.uid;

  try {
    if (body.action === "set_platform_role") {
      assertSuperAdmin(user);
      const targetUserId = String(body.payload.userId ?? "");
      const nextRole = String(body.payload.role ?? "") as UserRole | "none";
      if (!targetUserId) throw new Error("userId required");
      if (targetUserId === adminId) throw new Error("Cannot change your own platform role here");

      const db = getAdminFirestore();
      const ref = db.collection("users").doc(targetUserId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("User not found");
      const existing = (snap.data()?.roles as UserRole[] | undefined) ?? ["candidate"];
      if (existing.includes("super_admin") && nextRole !== "super_admin") {
        throw new Error("Super admin accounts cannot be demoted or removed from this screen");
      }
      const withoutStaff = existing.filter((r) => !PLATFORM_STAFF_ROLES.includes(r));
      let roles: UserRole[] = withoutStaff;
      if (nextRole === "super_admin" || nextRole === "admin" || nextRole === "coordinator") {
        roles = Array.from(new Set([...withoutStaff, nextRole, "candidate"])) as UserRole[];
      }
      await ref.set({ roles, updatedAt: Date.now() }, { merge: true });
      await getAdminAuth().setCustomUserClaims(targetUserId, { roles });
      // RTDB admins/{uid} mirrored by onUserWritten
      return NextResponse.json({ ok: true, roles });
    }

    // All other privileged mutations require platform admin (not coordinator).
    assertPlatformAdmin(user);

    switch (body.action) {
      case "review_change_request":
        await mergeChangeRequestAdmin({
          changeRequestId: String(body.payload.changeRequestId ?? ""),
          adminId,
          decision: body.payload.decision as "approved" | "rejected" | "info_requested",
          adminNote: body.payload.adminNote,
          slugify,
        });
        break;
      case "review_verification":
        await reviewVerificationAdmin({
          verificationId: String(body.payload.verificationId ?? ""),
          businessId: String(body.payload.businessId ?? ""),
          adminId,
          decision: body.payload.decision as "approved" | "rejected" | "info_requested",
          adminNote: body.payload.adminNote,
        });
        break;
      case "moderate_job":
        await moderateJobAdmin({
          jobId: String(body.payload.jobId ?? ""),
          adminId,
          decision: body.payload.decision as "published" | "rejected" | "closed",
          note: body.payload.adminNote,
          featured: body.payload.featured === "true",
        });
        break;
      case "suspend_user":
        await setUserSuspendedAdmin({
          userId: String(body.payload.userId ?? ""),
          adminId,
          suspended: body.payload.suspended === "true",
        });
        break;
      case "restore_business_deletion":
        await restoreBusinessDeletion({
          businessId: String(body.payload.businessId ?? ""),
          adminId,
        });
        break;
      case "purge_business":
        await purgeBusiness({
          businessId: String(body.payload.businessId ?? ""),
          adminId,
          confirmName: String(body.payload.confirmName ?? ""),
        });
        break;
      case "send_announcement":
        await sendAnnouncement({
          title: String(body.payload.title ?? ""),
          body: String(body.payload.body ?? ""),
          href: body.payload.href,
          audience: (body.payload.audience ?? "everyone") as
            | "candidates"
            | "employers"
            | "everyone",
          createdBy: adminId,
        });
        break;
      case "preview_announcement_audience": {
        const n = await countAnnouncementAudience(
          (body.payload.audience ?? "everyone") as "candidates" | "employers" | "everyone",
        );
        return NextResponse.json({ ok: true, recipients: n, cappedAt: 2000 });
      }
      case "sync_employer_member": {
        // No-op: onBusinessMemberWritten owns employerMembers / userEmployerMemberships.
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
