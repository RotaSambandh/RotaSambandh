"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";

export function ShareJobButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  }

  return (
    <IconButton label={copied ? "Link copied" : "Share job"} onClick={() => void share()}>
      <Share2 className="h-4 w-4" aria-hidden />
    </IconButton>
  );
}
