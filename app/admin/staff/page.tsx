"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { useAuth } from "@/components/auth/auth-provider";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { listStaffUsersRtdb } from "@/lib/dal/admin-rtdb";
import type { UserDoc, UserRole } from "@/shared/types";
import { isPlatformStaff, PLATFORM_STAFF_ROLES, isSuperAdmin as hasSuperAdminRole } from "@/shared/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { MenuSelect } from "@/components/ui/menu-select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Banner, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";

type PendingAction =
  | { kind: "assign"; email: string; userId: string; role: UserRole }
  | { kind: "remove"; person: UserDoc }
  | null;

export default function AdminStaffPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePlatformAccess();
  const [staff, setStaff] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!isFirebaseConfigured()) {
      setStaff([]);
      setLoading(false);
      return;
    }
    const all = await listStaffUsersRtdb();
    setStaff(all.filter((u) => isPlatformStaff(u.roles)));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((person) => {
      const roles = person.roles.filter((r) => PLATFORM_STAFF_ROLES.includes(r)).join(" ");
      const haystack = [person.displayName, person.email, roles]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [staff, search]);

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const role = String(fd.get("role")) as UserRole;
    try {
      if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured");
      }
      const matches = (await listStaffUsersRtdb()).filter(
        (u) => u.email.toLowerCase() === email,
      );
      if (matches.length === 0) {
        throw new Error("No user with that email. They must sign in with Google once first.");
      }
      const target = matches[0]!;
      const userId = target.uid;
      if (userId === user?.uid) {
        throw new Error("You cannot change your own platform role from this screen.");
      }
      if (hasSuperAdminRole(target.roles) && role !== "super_admin") {
        throw new Error("A super admin cannot be demoted or removed from this screen.");
      }
      setPending({ kind: "assign", email, userId, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  function requestRemove(person: UserDoc) {
    setError(null);
    setMessage(null);
    if (person.uid === user?.uid) {
      setError("You cannot remove your own staff access.");
      return;
    }
    if (hasSuperAdminRole(person.roles)) {
      setError("Super admins cannot be removed here. Contact another super admin or use ops tooling.");
      return;
    }
    setPending({ kind: "remove", person });
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "assign") {
        await callPrivilegedAdmin({
          action: "set_platform_role",
          payload: { userId: pending.userId, role: pending.role },
        });
        setMessage(`Updated ${pending.email} to ${pending.role}`);
      } else {
        await callPrivilegedAdmin({
          action: "set_platform_role",
          payload: { userId: pending.person.uid, role: "none" },
        });
        setMessage(`Removed staff access for ${pending.person.email}`);
      }
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <main>
        <EmptyState
          title="Super admin only"
          description="Only a super admin can invite, promote, or demote platform staff."
        />
      </main>
    );
  }

  if (loading) return <LoadingBlock label="Loading staff…" />;

  return (
    <main>
      <PageHeader
        title="Platform staff"
        description="Invite admins and coordinators by email. They must sign in with Google once first so a user record exists. Coordinators are view-only; admins can approve and moderate."
      />

      <Panel title="Assign role" className="mb-8">
        <form onSubmit={onAssign} className="space-y-4">
          <div>
            <Label htmlFor="email">User email</Label>
            <Input id="email" name="email" type="email" required placeholder="person@example.com" />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              They must already have signed into the app once (any portal) so we can find their account.
            </p>
          </div>
          <div>
            <MenuSelect
              id="role"
              name="role"
              label="Role"
              defaultValue="coordinator"
              options={[
                { value: "coordinator", label: "Coordinator (view / coordinate)" },
                { value: "admin", label: "Admin (approve & moderate)" },
                { value: "super_admin", label: "Super admin" },
              ]}
            />
          </div>
          <Button type="submit">Review &amp; save role</Button>
        </form>
      </Panel>

      <Panel
        title={`Current staff (${filteredStaff.length})`}
        toolbar={
          <div className="w-full min-w-[12rem] sm:w-56">
            <Input
              id="staff-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search staff"
            />
          </div>
        }
      >
        {staff.length === 0 ? (
          <EmptyState title="No staff yet" description="Assign the first admin or coordinator above." />
        ) : filteredStaff.length === 0 ? (
          <EmptyState title="No staff match" description="Try a different search." />
        ) : (
          <ul className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
            {filteredStaff.map((person) => {
              const isSelf = person.uid === user?.uid;
              const isTargetSuper = hasSuperAdminRole(person.roles);
              const canRemove = !isSelf && !isTargetSuper;
              const staffRoles = person.roles.filter((r) => PLATFORM_STAFF_ROLES.includes(r));
              return (
                <li key={person.uid}>
                  <ListRow
                    showChevron={false}
                    title={
                      <>
                        {person.displayName || person.email}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                            (you)
                          </span>
                        ) : null}
                      </>
                    }
                    subtitle={person.email}
                    meta={
                      <>
                        {staffRoles.map((r) => (
                          <Badge key={r} variant="neutral">
                            {r}
                          </Badge>
                        ))}
                      </>
                    }
                    trailing={
                      canRemove ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => requestRemove(person)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">
                          {isSelf ? "Your account" : "Protected"}
                        </span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {message && <Banner tone="success" title={message} className="mt-4" />}
      {error && <Banner tone="danger" title={error} className="mt-4" />}

      <ConfirmDialog
        open={pending?.kind === "assign"}
        title={
          pending?.kind === "assign" && pending.role === "super_admin"
            ? "Grant super admin?"
            : "Confirm role change"
        }
        description={
          pending?.kind === "assign" ? (
            <p>
              Assign <strong>{pending.role}</strong> to <strong>{pending.email}</strong>? They must
              sign out and back in for the new role to fully refresh on every device.
              {pending.role === "super_admin"
                ? " Super admins can manage all platform staff. Only grant this to trusted operators."
                : null}
            </p>
          ) : null
        }
        confirmLabel="Save role"
        tone={pending?.kind === "assign" && pending.role === "super_admin" ? "warning" : "default"}
        busy={busy}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => void confirmPending()}
      />

      <ConfirmDialog
        open={pending?.kind === "remove"}
        title="Remove staff access?"
        description={
          pending?.kind === "remove" ? (
            <p>
              Remove platform staff roles from{" "}
              <strong>{pending.person.displayName || pending.person.email}</strong>? They will keep
              their candidate account but lose admin portal access.
            </p>
          ) : null
        }
        confirmLabel="Remove access"
        tone="danger"
        busy={busy}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => void confirmPending()}
      />
    </main>
  );
}
