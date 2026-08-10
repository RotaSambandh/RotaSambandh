/**
 * Legacy registration path. Prefer /sw.js (merged offline + FCM).
 * Kept so older clients that registered this URL still receive background push.
 */
/* eslint-disable no-undef */
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
