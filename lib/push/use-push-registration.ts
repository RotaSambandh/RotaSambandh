"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/components/auth/auth-provider";
import { getClientMessaging, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  firebasePublicConfig,
  hasWebPushVapidKey,
} from "@/lib/firebase/public-config";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";
import { registerPushToken } from "@/lib/push/register-token";

/**
 * Best-effort silent registration when permission is already granted.
 * First-time permission is requested via NotificationPermissionBanner (user gesture).
 */
export function usePushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    let cancelled = false;

    async function run() {
      try {
        if (isNativeApp() && nativePlatform() === "android") {
          await registerAndroidIfGranted(user!.uid);
          return;
        }
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

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const token = await getToken(messaging, {
        vapidKey: firebasePublicConfig.vapidKey,
        serviceWorkerRegistration: reg,
      });
      if (token && !cancelled) await registerPushToken(uid, token);

      onMessage(messaging, () => {
        // Foreground: tray is source of truth.
      });
    }

    async function registerAndroidIfGranted(uid: string) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted" || cancelled) return;
      await PushNotifications.register();

      await PushNotifications.addListener("registration", (token) => {
        void registerPushToken(uid, token.value);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const href = action.notification.data?.href as string | undefined;
        if (href && typeof window !== "undefined") {
          window.location.assign(href);
        }
      });
    }
  }, [user]);
}
