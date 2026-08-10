import { Capacitor } from "@capacitor/core";

/**
 * True when running inside the Capacitor Android/iOS WebView.
 * Prefer the injected `window.Capacitor` bridge (always present in the native shell)
 * so remote `server.url` loads still detect native correctly.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const injected = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  if (typeof injected?.isNativePlatform === "function") {
    try {
      if (injected.isNativePlatform()) return true;
    } catch {
      // fall through
    }
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): string | null {
  if (!isNativeApp()) return null;
  try {
    return Capacitor.getPlatform();
  } catch {
    return null;
  }
}
