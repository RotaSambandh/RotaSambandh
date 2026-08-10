/**
 * Firebase Web SDK config - public by design (shipped to the browser).
 * Paste values from Firebase Console → Project settings → Your apps.
 * Not secrets. Do not put Admin private keys here.
 */
export const firebasePublicConfig = {
  apiKey: "AIzaSyBk8bSn8_KoMj9K-CjhJYZLDL1ChdrAWDI",
  authDomain: "rotasambandh2.firebaseapp.com",
  databaseURL:
    "https://rotasambandh2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rotasambandh2",
  storageBucket: "rotasambandh2.firebasestorage.app",
  messagingSenderId: "1077147403199",
  appId: "1:1077147403199:web:6906fbc2fd8d9962e8570a",
} as const;

export function hasFirebasePublicConfig(): boolean {
  return Boolean(
    firebasePublicConfig.apiKey &&
      firebasePublicConfig.projectId &&
      firebasePublicConfig.appId,
  );
}
