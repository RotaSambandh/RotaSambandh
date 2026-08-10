"use client";

import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";

/**
 * Native shell polish for the Capacitor Android (and future iOS) WebView:
 * branded status bar + hold splash until the first paint is ready.
 */
export function NativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;

    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (nativePlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#0a2540" });
        }
      } catch {
        // Plugin may be unavailable in some environments.
      }

      await new Promise((r) => setTimeout(r, 450));
      if (cancelled) return;
      try {
        await SplashScreen.hide({ fadeOutDuration: 280 });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
