"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationTray } from "@/components/notifications/notification-tray";
import { PushDeniedSettingsHint } from "@/components/notifications/notification-permission-sheet";
import { PageHeader } from "@/components/ui";

export default function CandidateNotificationsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader title="Notifications" description="Sign in to view your inbox." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Application updates and platform announcements. Push is optional; this list always stays up to date."
      />
      <PushDeniedSettingsHint />
      <NotificationTray userId={user.uid} />
    </main>
  );
}
