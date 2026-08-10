import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now } from "@/lib/utils";

/** Persist an FCM / Capacitor push token on the user doc (idempotent). */
export async function registerPushToken(userId: string, token: string): Promise<void> {
  if (!isFirebaseConfigured() || !token.trim()) return;
  await updateDoc(doc(getClientFirestore(), "users", userId), {
    fcmTokens: arrayUnion(token.trim()),
    updatedAt: now(),
  });
}
