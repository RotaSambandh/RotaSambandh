"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationTray } from "@/components/notifications/notification-tray";
import { PageHeader } from "@/components/ui";

export default function EmployerNotificationsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main>
        <PageHeader title="Notifications" description="Sign in to view your inbox." />
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Notifications"
        description="New applications, verification updates, and announcements. This tray does not require push permission."
      />
      <NotificationTray
        userId={user.uid}
        emptyDescription="Hiring updates and platform announcements will appear here."
      />
    </main>
  );
}
