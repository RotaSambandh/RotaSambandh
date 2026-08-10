"use client";

/**
 * Register /sw.js and wait until it is active before PushManager.subscribe / FCM getToken.
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  let registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.getRegistration());

  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  // Wait for install → activate when the worker is brand new.
  const installing = registration.installing;
  if (installing) {
    await new Promise<void>((resolve, reject) => {
      const onState = () => {
        if (installing.state === "activated") {
          installing.removeEventListener("statechange", onState);
          resolve();
        } else if (installing.state === "redundant") {
          installing.removeEventListener("statechange", onState);
          reject(new Error("Service worker failed to activate."));
        }
      };
      installing.addEventListener("statechange", onState);
    });
  }

  const ready = await navigator.serviceWorker.ready;
  if (!ready.active) {
    throw new Error(
      "Push could not start because the service worker is not active yet. Refresh the page and try again.",
    );
  }
  return ready;
}

export function friendlyPushError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/no active Service Worker/i.test(msg)) {
    return "Push could not start because the service worker is not ready. Refresh the page, then try Enable again.";
  }
  if (/Registration failed/i.test(msg) || /rejected/i.test(msg)) {
    return "Browser blocked push registration. Check site settings for notifications, then try again.";
  }
  return msg || "Could not enable notifications.";
}
