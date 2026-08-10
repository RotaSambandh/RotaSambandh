"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export default function EmployerProfilePage() {
  const { user, logout, roles } = useAuth();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Profile</h1>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-[var(--color-muted)]">Name</dt>
          <dd className="font-medium">{user?.displayName ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Email</dt>
          <dd className="font-medium">{user?.email ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Roles</dt>
          <dd className="font-medium">{roles.join(", ")}</dd>
        </div>
      </dl>
      <Button className="mt-8" variant="secondary" onClick={() => void logout()}>
        Sign out
      </Button>
    </main>
  );
}
