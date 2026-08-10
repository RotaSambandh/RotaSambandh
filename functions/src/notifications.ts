import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "crypto";
import { READ_MODEL_VERSION } from "./constants";

export type NotifyChannel = "candidate" | "employer" | "admin" | "auto";

export async function createAndDeliverNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
  audience?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
  /** Which RTDB inbox mirror to write. auto = derive from user roles. */
  channel?: NotifyChannel;
  /** Skip FCM even if tokens exist (tray-only). */
  skipPush?: boolean;
}) {
  const fs = getFirestore();

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
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    read: false,
    createdAt: ts,
    updatedAt: ts,
  };

  try {
    await ref.create(notification);
  } catch {
    // Already delivered for this dedupeKey.
    return ref.id;
  }

  const channel = await resolveChannel(input.userId, input.channel ?? "auto");
  const mirror = {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: input.href ?? "",
    read: false,
    createdAt: ts,
    updatedAt: ts,
    readModelVersion: READ_MODEL_VERSION,
  };

  const rtdb = getDatabase();
  // Unified inbox for badges across roles; keep candidate path for legacy readers.
  await rtdb.ref(`inbox/${input.userId}/notifications/${ref.id}`).set(mirror);
  if (channel === "candidate") {
    await rtdb.ref(`candidate/${input.userId}/notifications/${ref.id}`).set(mirror);
  }

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
        type: input.type,
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
          code.includes("invalid-registration-token") ||
          code.includes("invalid-argument")
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
    // Tray write already succeeded — push is best-effort.
  }

  return ref.id;
}

async function resolveChannel(userId: string, channel: NotifyChannel): Promise<NotifyChannel> {
  if (channel !== "auto") return channel;
  const snap = await getFirestore().doc(`users/${userId}`).get();
  const roles = (snap.data()?.roles as string[] | undefined) ?? [];
  if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("coordinator")) {
    return "admin";
  }
  if (roles.includes("employer")) return "employer";
  return "candidate";
}

/** Notify active company_admin (+ optional managers) for a business. */
export async function notifyBusinessMembers(input: {
  businessId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
  roles?: Array<"company_admin" | "manager">;
  excludeUserId?: string;
  dedupeKeyPrefix?: string;
}) {
  const roles = input.roles ?? ["company_admin", "manager"];
  const snap = await getFirestore()
    .collection("businessMembers")
    .where("businessId", "==", input.businessId)
    .limit(80)
    .get();

  const tasks: Promise<unknown>[] = [];
  for (const doc of snap.docs) {
    const m = doc.data() as {
      userId?: string;
      role?: string;
      status?: string;
    };
    if (!m.userId || m.status === "revoked" || m.status === "invited") continue;
    if (input.excludeUserId && m.userId === input.excludeUserId) continue;
    const role =
      m.role === "company_admin" || m.role === "owner" ? "company_admin" : "manager";
    if (!roles.includes(role)) continue;
    tasks.push(
      createAndDeliverNotification({
        userId: m.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        meta: input.meta,
        channel: "employer",
        dedupeKey: input.dedupeKeyPrefix
          ? `${input.dedupeKeyPrefix}:${m.userId}`
          : undefined,
      }),
    );
  }
  await Promise.all(tasks);
}

/** Notify all platform staff (admins RTDB index). */
export async function notifyPlatformStaff(input: {
  type: string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
  dedupeKeyPrefix?: string;
}) {
  const adminsSnap = await getDatabase().ref("admins").get();
  const map = (adminsSnap.val() as Record<string, boolean> | null) ?? {};
  const uids = Object.keys(map).filter((uid) => map[uid]);
  await Promise.all(
    uids.map((userId) =>
      createAndDeliverNotification({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        meta: input.meta,
        channel: "admin",
        dedupeKey: input.dedupeKeyPrefix ? `${input.dedupeKeyPrefix}:${userId}` : undefined,
      }),
    ),
  );
}
