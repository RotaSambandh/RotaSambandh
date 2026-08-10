import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { NotificationDoc, NotificationType } from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now } from "@/lib/utils";

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
}): Promise<NotificationDoc> {
  const ts = now();
  const id = isFirebaseConfigured()
    ? doc(collection(getClientFirestore(), "notifications")).id
    : `n_${ts}`;
  const notification: NotificationDoc = {
    id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    meta: input.meta,
    read: false,
    createdAt: ts,
    updatedAt: ts,
  };
  if (!isFirebaseConfigured()) return notification;
  await setDoc(doc(getClientFirestore(), "notifications", id), notification);
  return notification;
}

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
  const q = query(
    collection(getClientFirestore(), "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as NotificationDoc);
}

export async function markNotificationRead(id: string) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getClientFirestore(), "notifications", id), {
    read: true,
    updatedAt: now(),
  });
}
