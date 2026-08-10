"use client";

type Props = Record<string, string | number | boolean | undefined>;

/** Lightweight product analytics via Google Analytics (gtag). No third-party APM. */
export function trackEvent(name: string, props?: Props) {
  if (typeof window === "undefined") return;

  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
  };

  try {
    w.gtag?.("event", name, props);
  } catch {
    // ignore
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", name, props);
  }
}
