"use client";

import { FormEvent, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { searchUsers } from "@/lib/dal/admin";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { StatusPill } from "@/components/ui/status-pill";
import { Banner, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import type { UserDoc } from "@/shared/types";
import { isPlatformStaff } from "@/shared/rbac";

export default function AdminUsersPage() {
  const { canWrite } = usePlatformAccess();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserDoc[]>([]);
  const [selected, setSelected] = useState<UserDoc | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const prefix = query.trim();
    if (!prefix) return;
    setSearching(true);
    setMessage(null);
    setSelected(null);
    try {
      const users = await searchUsers(prefix);
      // Coordinators must not see other platform staff.
      const visible = canWrite ? users : users.filter((u) => !isPlatformStaff(u.roles));
      setResults(visible);
      if (visible.length === 1) setSelected(visible[0]!);
    } finally {
      setSearching(false);
    }
  }

  async function setSuspended(suspended: boolean) {
    if (!selected || !canWrite) return;
    setBusy(true);
    setMessage(null);
    try {
      await callPrivilegedAdmin({
        action: "suspend_user",
        payload: {
          userId: selected.uid,
          suspended: suspended ? "true" : "false",
        },
      });
      setSelected({ ...selected, suspended });
      setResults((prev) =>
        prev.map((u) => (u.uid === selected.uid ? { ...u, suspended } : u)),
      );
      setMessage({
        tone: "success",
        text: suspended
          ? `${selected.email} has been suspended.`
          : `${selected.email} has been restored.`,
      });
    } catch (err) {
      setMessage({
        tone: "danger",
        text: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Users"
        description="Search by email prefix, preview account details, then suspend or restore access."
      />

      {!canWrite && (
        <Banner tone="warning" title="Coordinator view">
          You can search and review accounts. Suspend and restore require admin access.
        </Banner>
      )}

      <Panel title="Search" className={!canWrite ? "mt-6" : undefined}>
        <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="email">Email prefix</Label>
            <Input
              id="email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
      </Panel>

      {searching && <LoadingBlock label="Searching users…" />}

      {!searching && results.length === 0 && query.trim() && (
        <EmptyState
          className="mt-6"
          title="No users found"
          description="Try a shorter email prefix or check spelling."
        />
      )}

      {results.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title={`Results (${results.length})`}>
            <ul className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
              {results.map((user) => (
                <li key={user.uid}>
                  <ListRow
                    onClick={() => setSelected(user)}
                    showChevron={false}
                    emphasize={selected?.uid === user.uid}
                    title={user.displayName || "Unnamed user"}
                    subtitle={user.email}
                    meta={
                      <>
                        {user.roles.map((role) => (
                          <Badge key={role} variant="neutral">
                            {role}
                          </Badge>
                        ))}
                        {user.suspended ? (
                          <StatusPill label="Suspended" tone="danger" />
                        ) : null}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Preview">
            {!selected ? (
              <EmptyState
                title="Select a user"
                description="Choose a result to preview account details and take action."
              />
            ) : (
              <div className="space-y-4">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-overline text-[var(--color-muted)]">Email</dt>
                    <dd className="font-medium">{selected.email}</dd>
                  </div>
                  <div>
                    <dt className="text-overline text-[var(--color-muted)]">Phone</dt>
                    <dd>{selected.phone?.trim() || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-overline text-[var(--color-muted)]">Display name</dt>
                    <dd>{selected.displayName || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-overline text-[var(--color-muted)]">Roles</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {selected.roles.map((role) => (
                        <Badge key={role} variant="neutral">
                          {role}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-overline text-[var(--color-muted)]">Status</dt>
                    <dd className="mt-1">
                      <StatusPill
                        label={selected.suspended ? "Suspended" : "Active"}
                        tone={selected.suspended ? "danger" : "success"}
                      />
                    </dd>
                  </div>
                </dl>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      disabled={busy || selected.suspended}
                      onClick={() => void setSuspended(true)}
                    >
                      Suspend
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || !selected.suspended}
                      onClick={() => void setSuspended(false)}
                    >
                      Restore
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {message && (
        <div className="mt-6">
          <Banner tone={message.tone} title={message.text} />
        </div>
      )}
    </main>
  );
}
