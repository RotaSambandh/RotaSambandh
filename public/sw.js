/* RotaSambandh — offline shell + FCM background handler (single SW). */
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBk8bSn8_KoMj9K-CjhJYZLDL1ChdrAWDI",
  authDomain: "rotasambandh2.firebaseapp.com",
  projectId: "rotasambandh2",
  messagingSenderId: "1077147403199",
  appId: "1:1077147403199:web:6906fbc2fd8d9962e8570a",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "RotaSambandh";
  const body = payload.notification?.body || payload.data?.body || "";
  const rawHref = payload.data?.href || "/";
  const href = typeof rawHref === "string" && rawHref.startsWith("/") ? rawHref : "/";
  self.registration.showNotification(title, {
    body,
    data: { href },
    icon: "/icons/icon-192.png",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href =
    typeof event.notification.data?.href === "string" &&
    event.notification.data.href.startsWith("/")
      ? event.notification.data.href
      : "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate?.(href);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(href);
    }),
  );
});

const CACHE = "rotasambandh-shell-v3";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  const path = url.pathname;
  if (path.startsWith("/_next/")) return true;
  if (path.startsWith("/api/")) return true;
  if (path.startsWith("/auth/")) return true;
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/employer" || path.startsWith("/employer/")) return true;
  if (path === "/candidate" || path.startsWith("/candidate/")) return true;
  if (path === "/jobs" || path.startsWith("/jobs/")) return true;
  if (path === "/companies" || path.startsWith("/companies/")) return true;
  if (path === "/employer/sign-in" || path === "/employer/sign-up") return true;
  if (path === "/sw.js" || path === "/firebase-messaging-sw.js") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === "/") {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          await cache.put(request, copy);
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain" },
        });
      }
    })(),
  );
});
