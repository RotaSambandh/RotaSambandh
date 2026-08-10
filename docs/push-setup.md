# Android push (Capacitor + FCM)

1. Firebase Console → Project settings → Your apps → Add Android app  
   - Package name: `app.rotasambandh.mobile`
2. Download `google-services.json` into `android/app/google-services.json`
3. Ensure `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set for PWA/web push (Firebase → Cloud Messaging → Web Push certificates)
4. **Release builds:** set `NEXT_PUBLIC_APP_URL=https://rotasambandh.com`, then run `npx cap sync android`. Confirm `android/app/src/main/assets/capacitor.config.json` shows that HTTPS URL (not `http://localhost:3000`) and `cleartext: false`.
5. Rebuild the Android app; grant notification permission when prompted

Push is optional. The in-app notification tray always receives events without OS permission.

PWA uses a single service worker at `/sw.js` (offline shell + FCM). Do not register a second worker for messaging.
