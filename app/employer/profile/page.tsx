"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui";

export default function EmployerProfilePage() {
  const { user, logout } = useAuth();
  return (
    <main>
      <PageHeader title="Profile" description="Your account on RotaSambandh." />
      <Panel>
        <dl className="space-y-3 text-body">
          <div>
            <dt className="text-caption text-[var(--color-muted)]">Name</dt>
            <dd className="font-medium">{user?.displayName ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--color-muted)]">Email</dt>
            <dd className="font-medium">{user?.email ?? "Not set"}</dd>
          </div>
        </dl>
        <Button className="mt-6" variant="secondary" onClick={() => void logout()}>
          Sign out
        </Button>
      </Panel>
    </main>
  );
}
