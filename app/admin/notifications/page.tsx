"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationTray } from "@/components/notifications/notification-tray";
import { PushDeniedSettingsHint } from "@/components/notifications/notification-permission-sheet";
import { PageHeader } from "@/components/ui";

export default function AdminNotificationsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main>
        <PageHeader title="Notifications" description="Sign in to view ops alerts." />
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Notifications"
        description="Review-queue digests and deletion requests. Push is optional."
      />
      <PushDeniedSettingsHint />
      <NotificationTray
        userId={user.uid}
        emptyDescription="Pending queue updates and high-priority ops alerts will appear here."
      />
    </main>
  );
}
