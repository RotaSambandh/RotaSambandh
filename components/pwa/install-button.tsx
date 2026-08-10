"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = "rs.pwaInstall.dismissedAt";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function recentlyDismissed(): boolean {
  const raw = window.localStorage.getItem(DISMISS_KEY);
  const at = raw ? Number(raw) : 0;
  return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
}

/** Captures beforeinstallprompt and offers a modest Install control. */
export function PwaInstallButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    function onPrompt(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferred(e);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
  }

  return (
    <div className={className}>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void install()}>
        <Download className="h-4 w-4" aria-hidden />
        {busy ? "Installing…" : "Install app"}
      </Button>
      <button
        type="button"
        className="ml-2 text-caption text-[var(--color-muted)] underline-offset-2 hover:underline"
        onClick={dismiss}
      >
        Not now
      </button>
    </div>
  );
}
