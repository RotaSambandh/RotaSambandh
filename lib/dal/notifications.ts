import { get, ref } from "firebase/database";
import { doc, writeBatch, updateDoc } from "firebase/firestore";
import type { NotificationDoc, NotificationType } from "@/shared/types";
import { NOTIFICATION_INBOX_CAP } from "@/shared/constants";
import {
  getClientFirestore,
  getClientRtdb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { now } from "@/lib/utils";

/** UI reads from RTDB inbox only. */
export async function listNotifications(userId: string): Promise<NotificationDoc[]> {
  if (!isFirebaseConfigured()) {
    return [
      {
        id: "n_demo",
        userId,
        type: "application_status_changed",
        title: "Application update",
        body: "Your application for Product Manager is under review.",
        href: "/candidate/applications",
        read: false,
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000,
      },
    ];
  }
  try {
    const snap = await get(ref(getClientRtdb(), `inbox/${userId}/notifications`));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val)
      .map(
        (n) =>
          ({
            id: String(n.id ?? ""),
            userId: String(n.userId ?? userId),
            type: n.type as NotificationType,
            title: String(n.title ?? ""),
            body: String(n.body ?? ""),
            href: n.href ? String(n.href) : undefined,
            read: Boolean(n.read),
            createdAt: Number(n.createdAt ?? 0),
            updatedAt: Number(n.updatedAt ?? 0),
          }) satisfies NotificationDoc,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, NOTIFICATION_INBOX_CAP);
  } catch {
    return [];
  }
}

/** Mutation only — Functions mirror read flag into RTDB. */
export async function markNotificationRead(id: string) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getClientFirestore(), "notifications", id), {
    read: true,
    updatedAt: now(),
  });
}

/** Delete all notifications currently visible in the tray (owner delete). */
export async function clearAllNotifications(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const items = await listNotifications(userId);
  const ids = items.map((n) => n.id).filter(Boolean);
  if (ids.length === 0) return;

  const db = getClientFirestore();
  const chunkSize = 400;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, "notifications", id));
    }
    await batch.commit();
  }
}
