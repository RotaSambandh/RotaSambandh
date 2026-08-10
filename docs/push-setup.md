# Android push (Capacitor + FCM)

1. Firebase Console → Project settings → Your apps → Add Android app  
   - Package name: `app.rotasambandh.mobile`
2. Download `google-services.json` into `android/app/google-services.json`
3. **Google Sign-In (required for the APK):** Firebase Console → Project settings → Your Android app → **Add fingerprint**
   - Debug SHA-1: `E1:18:F3:54:C5:C6:E1:9A:12:6B:7C:40:85:42:D9:EF:34:6E:6E:A0`
   - Then download a fresh `google-services.json` (it should include an Android OAuth client) and replace `android/app/google-services.json`
4. Ensure `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set for PWA/web push (Firebase → Cloud Messaging → Web Push certificates)
5. **Release builds:** set `NEXT_PUBLIC_APP_URL=https://rotasambandh.com`, then run `npx cap sync android`. Confirm `android/app/src/main/assets/capacitor.config.json` shows that HTTPS URL (not `http://localhost:3000`) and `cleartext: false`.
6. Rebuild the Android app; grant notification permission when prompted

Native Google sign-in uses `@capacitor-firebase/authentication` (no Chrome hand-off). Web continues to use `signInWithPopup`.

Push is optional. The in-app notification tray always receives events without OS permission.

PWA uses a single service worker at `/sw.js` (offline shell + FCM). Do not register a second worker for messaging.
