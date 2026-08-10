"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearAllNotifications,
  listNotifications,
  markNotificationRead,
} from "@/lib/dal/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock } from "@/components/ui";
import type { NotificationDoc } from "@/shared/types";

const UNREAD_EVENT = "rs:notifications-changed";

function notifyUnreadChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNREAD_EVENT));
  }
}

export function NotificationTray({
  userId,
  emptyDescription = "Status changes and announcements will appear here.",
}: {
  userId: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listNotifications(userId);
    setItems(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function openNotification(n: NotificationDoc) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      );
      notifyUnreadChanged();
    }
    if (n.href) {
      router.push(n.href);
    }
  }

  async function onClearAll() {
    if (items.length === 0) return;
    const ok = window.confirm("Remove all notifications from this inbox?");
    if (!ok) return;
    setClearing(true);
    try {
      await clearAllNotifications(userId);
      setItems([]);
      notifyUnreadChanged();
    } finally {
      setClearing(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading notifications…" />;

  if (items.length === 0) {
    return (
      <EmptyState title="No notifications" description={emptyDescription} />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={clearing}
          onClick={() => void onClearAll()}
        >
          {clearing ? "Clearing…" : "Clear all"}
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="w-full px-4 py-4 text-left transition-colors hover:bg-[var(--color-surface)]"
              onClick={() => void openNotification(n)}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                {!n.read ? <Badge variant="default">New</Badge> : null}
              </div>
              <p className="mt-1 text-caption text-[var(--color-muted)]">{n.body}</p>
              <p className="mt-1 text-caption text-[var(--color-muted)]">
                {new Date(n.createdAt).toLocaleString()}
              </p>
              {n.href ? (
                <span className="mt-2 inline-block text-caption font-medium text-[var(--color-accent-strong)]">
                  Open
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function useUnreadNotificationCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    void listNotifications(userId).then((list) => {
      setCount(list.filter((n) => !n.read).length);
    });
  }, [userId]);

  useEffect(() => {
    refresh();
    if (typeof window === "undefined") return;
    const onChange = () => refresh();
    window.addEventListener(UNREAD_EVENT, onChange);
    return () => window.removeEventListener(UNREAD_EVENT, onChange);
  }, [refresh]);

  return count;
}
