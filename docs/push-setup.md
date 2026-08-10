# Web Push (PWA)

1. Web Push VAPID public key lives in `lib/firebase/public-config.ts` (`vapidKey`).
   Rotate it from Firebase → Cloud Messaging → Web Push certificates if needed.
2. Ensure production env includes the matching VAPID key and Firebase web config.
3. Users opt in via the in-app permission sheet after sign-in (user gesture). Silent registration runs when permission is already granted.

Push is optional. The in-app notification tray always receives events without OS permission.

PWA uses a single service worker at `/sw.js` (offline shell + FCM). Do not register a second worker for messaging.

Installable app: browsers that support `beforeinstallprompt` show **Install app** in the account menu (`components/pwa/install-button.tsx`). iOS Safari users can Add to Home Screen from the share sheet.
