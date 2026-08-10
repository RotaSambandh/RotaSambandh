"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationTray } from "@/components/notifications/notification-tray";
import { PageHeader } from "@/components/ui";

export default function AdminNotificationsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader title="Notifications" description="Sign in to view ops alerts." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Review-queue digests, deletion requests, and reports. Push is optional."
      />
      <NotificationTray
        userId={user.uid}
        emptyDescription="Pending queue updates and high-priority ops alerts will appear here."
      />
    </main>
  );
}
