"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { getToken, onMessage } from "firebase/messaging";
import { useAuth } from "@/components/auth/auth-provider";
import { getClientMessaging, isFirebaseConfigured } from "@/lib/firebase/client";
import { registerPushToken } from "@/lib/push/register-token";

/**
 * Best-effort push registration. Tray notifications never depend on this.
 * Web/PWA uses Firebase Messaging + VAPID; Android uses Capacitor Push.
 */
export function usePushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    let cancelled = false;

    async function run() {
      try {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
          await registerAndroid(user!.uid);
          return;
        }
        await registerWeb(user!.uid);
      } catch {
        // Permission denied or unsupported — tray still works.
      }
    }

    void run();
    return () => {
      cancelled = true;
    };

    async function registerWeb(uid: string) {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapid) return;

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted" || cancelled) return;

      const messaging = await getClientMessaging();
      if (!messaging || cancelled) return;

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const token = await getToken(messaging, {
        vapidKey: vapid,
        serviceWorkerRegistration: reg,
      });
      if (token && !cancelled) await registerPushToken(uid, token);

      onMessage(messaging, () => {
        // Foreground: tray is source of truth; optional UI can refresh lists.
      });
    }

    async function registerAndroid(uid: string) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
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
