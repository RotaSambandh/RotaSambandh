"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native shell polish for the Capacitor Android (and future iOS) WebView:
 * branded status bar + hold splash until the first paint is ready.
 */
export function NativeShell() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#0a2540" });
        }
      } catch {
        // Plugin may be unavailable in some environments.
      }

      // Let the first meaningful paint settle, then fade splash.
      await new Promise((r) => setTimeout(r, 450));
      if (cancelled) return;
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
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
