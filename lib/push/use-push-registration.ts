"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/components/auth/auth-provider";
import { getClientMessaging, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  firebasePublicConfig,
  hasWebPushVapidKey,
} from "@/lib/firebase/public-config";
import { ensurePushServiceWorker } from "@/lib/push/ensure-service-worker";
import { registerPushToken } from "@/lib/push/register-token";

/**
 * Best-effort silent registration when permission is already granted.
 * First-time permission is requested via NotificationPermissionSheet (user gesture).
 */
export function usePushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    let cancelled = false;

    async function run() {
      try {
        await registerWebIfGranted(user!.uid);
      } catch {
        // Permission denied or unsupported — tray still works.
      }
    }

    void run();
    return () => {
      cancelled = true;
    };

    async function registerWebIfGranted(uid: string) {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (!hasWebPushVapidKey()) return;

      const messaging = await getClientMessaging();
      if (!messaging || cancelled) return;

      const reg = await ensurePushServiceWorker();
      const token = await getToken(messaging, {
        vapidKey: firebasePublicConfig.vapidKey,
        serviceWorkerRegistration: reg,
      });
      if (token && !cancelled) await registerPushToken(uid, token);

      onMessage(messaging, () => {
        // Foreground: tray is source of truth.
      });
    }
  }, [user]);
}
