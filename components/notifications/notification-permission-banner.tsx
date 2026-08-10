"use client";

import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getClientMessaging, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  firebasePublicConfig,
  hasWebPushVapidKey,
} from "@/lib/firebase/public-config";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";
import { registerPushToken } from "@/lib/push/register-token";

const DISMISS_KEY = "rs.pushPrompt.dismissed";

/**
 * Visible opt-in for browser / OS notifications.
 * Auto-prompting on page load is blocked by browsers; we need a click.
 */
export function NotificationPermissionBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") {
      setVisible(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (isNativeApp() && nativePlatform() === "android") {
        try {
          const { PushNotifications } = await import(
            "@capacitor/push-notifications"
          );
          const status = await PushNotifications.checkPermissions();
          if (!cancelled) setVisible(status.receive === "prompt");
        } catch {
          if (!cancelled) setVisible(false);
        }
        return;
      }

      if (!("Notification" in window)) {
        setVisible(false);
        return;
      }
      if (!hasWebPushVapidKey()) {
        // Can't complete web push without VAPID — keep banner hidden.
        setVisible(false);
        return;
      }
      setVisible(Notification.permission === "default");
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!visible) return null;

  async function enable() {
    setBusy(true);
    setHint(null);
    try {
      if (isNativeApp() && nativePlatform() === "android") {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") {
          setHint("Notifications were not allowed. You can enable them later in system settings.");
          setVisible(false);
          return;
        }
        await PushNotifications.register();
        await new Promise<void>((resolve) => {
          void PushNotifications.addListener("registration", (token) => {
            void registerPushToken(user!.uid, token.value).finally(resolve);
          });
          // Don't hang forever if FCM is slow.
          setTimeout(resolve, 4000);
        });
        setVisible(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setHint("Notifications were not allowed.");
        window.localStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
        return;
      }
      if (!hasWebPushVapidKey()) {
        setHint("Push is not configured (missing VAPID key).");
        setVisible(false);
        return;
      }
      const messaging = await getClientMessaging();
      if (!messaging) {
        setHint("This browser does not support web push.");
        setVisible(false);
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const token = await getToken(messaging, {
        vapidKey: firebasePublicConfig.vapidKey,
        serviceWorkerRegistration: reg,
      });
      if (token) await registerPushToken(user!.uid, token);
      setVisible(false);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            Turn on notifications
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
            Get alerts when applications move or employers reply. You can change this anytime.
          </p>
          {hint && (
            <p className="mt-1 text-sm text-[var(--color-danger)]" role="status">
              {hint}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={dismiss}>
            Not now
          </Button>
          <Button type="button" disabled={busy} onClick={() => void enable()}>
            {busy ? "Enabling…" : "Enable"}
          </Button>
        </div>
      </div>
    </div>
  );
}
