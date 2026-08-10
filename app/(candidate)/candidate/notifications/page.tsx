"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationTray } from "@/components/notifications/notification-tray";
import { PageHeader } from "@/components/ui";

export default function CandidateNotificationsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? "demo_candidate";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Application updates and platform announcements. Push alerts are optional — this list always stays up to date."
      />
      <NotificationTray userId={uid} />
    </main>
  );
}
