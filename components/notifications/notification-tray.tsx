"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listNotifications, markNotificationRead } from "@/lib/dal/notifications";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingBlock } from "@/components/ui";
import type { NotificationDoc } from "@/shared/types";

export function NotificationTray({
  userId,
  emptyDescription = "Status changes and announcements will appear here.",
}: {
  userId: string;
  emptyDescription?: string;
}) {
  const [items, setItems] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listNotifications(userId);
    setItems(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingBlock label="Loading notifications…" />;

  if (items.length === 0) {
    return (
      <EmptyState title="No notifications" description={emptyDescription} />
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] bg-white">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className="w-full px-4 py-4 text-left transition-colors hover:bg-[var(--color-surface)]"
            onClick={() => {
              void markNotificationRead(n.id);
              setItems((prev) =>
                prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
              );
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{n.title}</p>
              {!n.read ? <Badge variant="default">New</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{n.body}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {new Date(n.createdAt).toLocaleString()}
            </p>
            {n.href ? (
              <Link
                href={n.href}
                className="mt-2 inline-block text-sm font-medium text-[var(--color-accent-strong)]"
                onClick={(e) => e.stopPropagation()}
              >
                Open
              </Link>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function useUnreadNotificationCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    void listNotifications(userId).then((list) => {
      if (!cancelled) setCount(list.filter((n) => !n.read).length);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return count;
}
