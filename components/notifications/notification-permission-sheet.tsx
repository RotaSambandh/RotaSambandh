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
import {
  ensurePushServiceWorker,
  friendlyPushError,
} from "@/lib/push/ensure-service-worker";
import { registerPushToken } from "@/lib/push/register-token";

const COOLDOWN_KEY = "rs.pushPrompt.cooldownUntil";
const DISMISS_COUNT_KEY = "rs.pushPrompt.dismissCount";
const DENIED_KEY = "rs.pushPrompt.denied";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSES = 3;

type Role = "candidate" | "employer" | "admin";

function roleCopy(role: Role): { title: string; body: string } {
  switch (role) {
    case "candidate":
      return {
        title: "Stay updated on applications",
        body: "Get a push when an application moves or an employer replies. You can change this anytime in system settings.",
      };
    case "employer":
      return {
        title: "Hear about new applicants",
        body: "Get a push for new applications and verification updates. You can change this anytime in system settings.",
      };
    case "admin":
      return {
        title: "Get review alerts on your phone",
        body: "Get a push for queue digests and priority updates. You can change this anytime in system settings.",
      };
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function readDismissCount(): number {
  const raw = window.localStorage.getItem(DISMISS_COUNT_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function isCoolingDown(): boolean {
  const raw = window.localStorage.getItem(COOLDOWN_KEY);
  const until = raw ? Number(raw) : 0;
  return Number.isFinite(until) && until > Date.now();
}

/** True when the OS already denied notifications (no further prompts). */
export function isPushPermissionDenied(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(DENIED_KEY) === "1") return true;
  if ("Notification" in window && Notification.permission === "denied") return true;
  return false;
}

/**
 * Decisive post-login sheet for push opt-in.
 * Never gates core flows. Cool-down + lifetime cap; no re-prompt after deny.
 */
export function NotificationPermissionSheet({ role }: { role: Role }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const copy = roleCopy(role);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DENIED_KEY) === "1") {
      setVisible(false);
      return;
    }
    if (readDismissCount() >= MAX_DISMISSES || isCoolingDown()) {
      setVisible(false);
      return;
    }

    if (!("Notification" in window)) {
      setVisible(false);
      return;
    }
    if (Notification.permission === "denied") {
      window.localStorage.setItem(DENIED_KEY, "1");
      setVisible(false);
      return;
    }
    if (!hasWebPushVapidKey()) {
      setVisible(false);
      return;
    }
    setVisible(Notification.permission === "default");
  }, [user]);

  if (!visible) return null;

  async function enable() {
    setBusy(true);
    setHint(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        window.localStorage.setItem(DENIED_KEY, "1");
        setHint("Notifications were not allowed.");
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
      const reg = await ensurePushServiceWorker();
      const token = await getToken(messaging, {
        vapidKey: firebasePublicConfig.vapidKey,
        serviceWorkerRegistration: reg,
      });
      if (token) await registerPushToken(user!.uid, token);
      setVisible(false);
    } catch (err) {
      setHint(friendlyPushError(err));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    const next = readDismissCount() + 1;
    window.localStorage.setItem(DISMISS_COUNT_KEY, String(next));
    window.localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
    setVisible(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
    >
      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-5 shadow-lg">
        <p id="push-prompt-title" className="text-subtitle text-[var(--color-ink)]">
          {copy.title}
        </p>
        <p className="mt-2 text-caption text-[var(--color-muted)]">{copy.body}</p>
        {hint && (
          <p className="mt-2 text-caption text-[var(--color-danger)]" role="status">
            {hint}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
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

/** Soft hint when push was denied; shown on notifications pages only. */
export function PushDeniedSettingsHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isPushPermissionDenied());
  }, []);

  if (!show) return null;

  return (
    <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-caption text-[var(--color-muted)]">
      Push notifications are off for this device. To turn them on, open your system or browser
      settings for RotaSambandh and allow notifications. This inbox still updates without push.
    </p>
  );
}
