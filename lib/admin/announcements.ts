import "server-only";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { deliverNotification } from "@/lib/notifications/deliver";
import type { Announcement, AnnouncementAudience, UserDoc, UserRole } from "@/shared/types";

function matchesAudience(roles: UserRole[] | undefined, audience: AnnouncementAudience): boolean {
  const r = roles ?? [];
  if (audience === "everyone") return true;
  if (audience === "candidates") return r.includes("candidate");
  if (audience === "employers") return r.includes("employer");
  return false;
}

/** Fan-out a platform announcement into per-user tray (+ optional push). */
export async function countAnnouncementAudience(
  audience: AnnouncementAudience,
): Promise<number> {
  const db = getAdminFirestore();
  let count = 0;
  let last: QueryDocumentSnapshot | undefined;
  const maxUsers = 2000;

  while (count < maxUsers) {
    let q = db.collection("users").orderBy("__name__").limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];
    for (const doc of snap.docs) {
      const user = doc.data() as UserDoc;
      if (!matchesAudience(user.roles, audience)) continue;
      count += 1;
      if (count >= maxUsers) break;
    }
    if (snap.size < 200) break;
  }
  return count;
}

/** Fan-out a platform announcement into per-user tray (+ optional push). */
export async function sendAnnouncement(input: {
  title: string;
  body: string;
  href?: string;
  audience: AnnouncementAudience;
  createdBy: string;
}): Promise<{ announcementId: string; recipients: number }> {
  if (!input.title.trim() || !input.body.trim()) {
    throw new Error("Title and body are required");
  }

  const db = getAdminFirestore();
  const ts = Date.now();
  const ref = db.collection("announcements").doc();
  const announcement: Announcement = {
    id: ref.id,
    title: input.title.trim(),
    body: input.body.trim(),
    href: input.href?.trim() || undefined,
    audience: input.audience,
    createdBy: input.createdBy,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set(announcement);

  // Paginate users — cap fan-out for safety in v1.
  let recipients = 0;
  let last: QueryDocumentSnapshot | undefined;
  const maxUsers = 2000;

  while (recipients < maxUsers) {
    let q = db.collection("users").orderBy("__name__").limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];

    const batchTasks: Promise<unknown>[] = [];
    for (const doc of snap.docs) {
      const user = doc.data() as UserDoc;
      if (user.uid === input.createdBy) continue;
      if (!matchesAudience(user.roles, input.audience)) continue;
      batchTasks.push(
        deliverNotification({
          userId: user.uid || doc.id,
          type: "platform_announcement",
          title: announcement.title,
          body: announcement.body,
          href: announcement.href ?? "/candidate/notifications",
          audience: announcement.audience,
          dedupeKey: `announce:${announcement.id}:${user.uid || doc.id}`,
        }),
      );
      recipients += 1;
      if (recipients >= maxUsers) break;
    }
    await Promise.all(batchTasks);
    if (snap.size < 200) break;
  }

  await db.collection("adminActions").add({
    adminId: input.createdBy,
    action: "announcement_sent",
    targetType: "announcement",
    targetId: announcement.id,
    note: `${announcement.audience}: ${announcement.title} (${recipients} recipients)`,
    createdAt: ts,
    updatedAt: ts,
  });

  return { announcementId: announcement.id, recipients };
}
