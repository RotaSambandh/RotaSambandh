"use client";

import { FormEvent, useEffect, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MenuSelect } from "@/components/ui/menu-select";
import { Banner, PageHeader, Panel } from "@/components/ui";
import type { AnnouncementAudience } from "@/shared/types";

const AUDIENCE_OPTIONS: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: "everyone", label: "Everyone on the platform" },
  { value: "candidates", label: "Candidates only" },
  { value: "employers", label: "Employers only" },
];

export default function AdminAnnouncementsPage() {
  const { canWrite } = usePlatformAccess();
  const [audience, setAudience] = useState<AnnouncementAudience>("everyone");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!canWrite) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await callPrivilegedAdmin({
          action: "preview_announcement_audience",
          payload: { audience },
        });
        if (!cancelled && typeof res.recipients === "number") {
          setRecipientCount(res.recipients);
        }
      } catch {
        if (!cancelled) setRecipientCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audience, canWrite]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    const fd = new FormData(form);
    try {
      await callPrivilegedAdmin({
        action: "send_announcement",
        payload: {
          title: String(fd.get("title") ?? ""),
          body: String(fd.get("body") ?? ""),
          href: String(fd.get("href") ?? "") || undefined,
          audience,
        },
      });
      setMessage({
        tone: "success",
        text: "Announcement sent. Recipients will see it in their notification tray (and push if enabled).",
      });
      form.reset();
    } catch (err) {
      setMessage({
        tone: "danger",
        text: err instanceof Error ? err.message : "Failed to send",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Announcements"
        description="Broadcast to candidates, employers, or everyone. Messages always land in the in-app tray; push is optional for each user."
      />

      {!canWrite ? (
        <Banner tone="warning" title="Coordinator view">
          Coordinators can review queues. Sending announcements requires admin access.
        </Banner>
      ) : (
        <Panel title="Compose announcement">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <MenuSelect
                id="audience"
                label="Audience"
                value={audience}
                onValueChange={(v) => setAudience(v as AnnouncementAudience)}
                options={AUDIENCE_OPTIONS}
              />
              {recipientCount !== null ? (
                <p className="mt-2 text-caption text-[var(--color-muted)]">
                  About <strong>{recipientCount}</strong> recipient
                  {recipientCount === 1 ? "" : "s"} in this audience
                  {recipientCount >= 2000 ? " (capped at 2,000)" : ""}. Confirm before sending.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" required rows={5} maxLength={2000} />
            </div>
            <div>
              <Label htmlFor="href">Link (optional)</Label>
              <Input id="href" name="href" placeholder="/jobs" />
            </div>
            <Banner tone="info" title="Delivery">
              Prefer infrequent, high-signal updates. Every recipient gets a tray item; those who
              granted push permission may also get an OS notification.
            </Banner>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Sending…"
                : recipientCount !== null
                  ? `Send to ~${recipientCount}`
                  : "Send announcement"}
            </Button>
          </form>
        </Panel>
      )}

      {message ? (
        <div className="mt-6">
          <Banner tone={message.tone} title={message.text} />
        </div>
      ) : null}
    </main>
  );
}
