import "server-only";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminRtdb } from "@/lib/firebase/admin";
import { getMessaging } from "firebase-admin/messaging";
import type { NotificationType } from "@/shared/types";
import { NOTIFICATION_INBOX_CAP } from "@/shared/constants";

/**
 * Server-side (Next.js Admin SDK) twin of functions createAndDeliverNotification.
 * Always writes the tray; push is best-effort.
 */
async function enforceInboxCap(userId: string) {
  const fs = getAdminFirestore();
  const snap = await fs
    .collection("notifications")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .offset(NOTIFICATION_INBOX_CAP)
    .limit(200)
    .get();
  if (snap.empty) return;
  const batch = fs.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export async function deliverNotification(input: {
  userId: string;
  type: NotificationType | string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
  audience?: string;
  dedupeKey?: string;
  skipPush?: boolean;
}): Promise<string> {
  const fs = getAdminFirestore();
  const id = input.dedupeKey
    ? createHash("sha256")
        .update(`${input.userId}:${input.dedupeKey}`)
        .digest("hex")
        .slice(0, 40)
    : undefined;
  const ref = id ? fs.collection("notifications").doc(id) : fs.collection("notifications").doc();
  const ts = Date.now();
  const notification = {
    id: ref.id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    meta: input.meta ?? null,
    audience: input.audience ?? null,
    dedupeKey: input.dedupeKey ?? null,
    read: false,
    createdAt: ts,
    updatedAt: ts,
  };

  try {
    await ref.create(notification);
  } catch {
    return ref.id;
  }

  await enforceInboxCap(input.userId).catch(() => undefined);

  // RTDB inbox mirror is owned by onNotificationWritten (Functions).

  if (input.skipPush) return ref.id;

  const userSnap = await fs.doc(`users/${input.userId}`).get();
  const tokens = (userSnap.data()?.fcmTokens as string[] | undefined) ?? [];
  if (tokens.length === 0) return ref.id;

  try {
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: input.title, body: input.body },
      data: {
        href: input.href ?? "",
        notificationId: ref.id,
        type: String(input.type),
        title: input.title,
        body: input.body,
      },
    });
    const bad: string[] = [];
    result.responses.forEach((res, i) => {
      if (!res.success) {
        const code = res.error?.code ?? "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          const token = tokens[i];
          if (token) bad.push(token);
        }
      }
    });
    if (bad.length > 0) {
      await fs.doc(`users/${input.userId}`).update({
        fcmTokens: FieldValue.arrayRemove(...bad),
        updatedAt: Date.now(),
      });
    }
  } catch {
    // best-effort
  }

  return ref.id;
}

export async function deliverToPlatformStaff(input: {
  type: NotificationType | string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
  dedupeKeyPrefix?: string;
}) {
  const snap = await getAdminRtdb().ref("admins").get();
  const map = (snap.val() as Record<string, boolean> | null) ?? {};
  await Promise.all(
    Object.keys(map)
      .filter((uid) => map[uid])
      .map((userId) =>
        deliverNotification({
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          meta: input.meta,
          dedupeKey: input.dedupeKeyPrefix
            ? `${input.dedupeKeyPrefix}:${userId}`
            : undefined,
        }),
      ),
  );
}
