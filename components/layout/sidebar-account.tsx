"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Briefcase, Building2, ChevronUp, LayoutDashboard, LogOut, User } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useOptionalActiveBusiness } from "@/components/employer/active-business-provider";
import {
  accessiblePortals,
  portalHome,
  portalLabel,
  portalSignInPath,
  type Portal,
} from "@/lib/auth/portal";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "?";
}

function profileHrefFor(role: Portal): string {
  switch (role) {
    case "candidate":
      return "/candidate/profile";
    case "employer":
      return "/employer/profile";
    case "admin":
      return "/admin";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function PortalIcon({ portal }: { portal: Portal }) {
  switch (portal) {
    case "candidate":
      return <User className="h-3.5 w-3.5" aria-hidden />;
    case "employer":
      return <Briefcase className="h-3.5 w-3.5" aria-hidden />;
    case "admin":
      return <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />;
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

export function SidebarAccount({
  role,
  variant = "desktop",
}: {
  role: Portal;
  variant?: "desktop" | "mobile";
}) {
  const { user, roles, logout } = useAuth();
  const activeBiz = useOptionalActiveBusiness();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const name = user.displayName || user.email || "Account";
  const email = user.email ?? "";
  const profileHref = profileHrefFor(role);
  const isMobile = variant === "mobile";
  const portals = accessiblePortals(roles);
  const otherPortals = portals.filter((p) => p !== role);
  // Multi-company is rare — only surface switcher when more than one company exists.
  const showCompanySwitch =
    role === "employer" && (activeBiz?.businesses.length ?? 0) > 1 && Boolean(activeBiz);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
      router.replace(portalSignInPath(role));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        isMobile
          ? "border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-2 backdrop-blur"
          : "border-t border-[var(--color-border)] p-3",
      )}
    >
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-40 overflow-hidden rounded-md border border-[var(--color-border)] bg-white shadow-sm",
            isMobile
              ? "bottom-[calc(100%+0.35rem)] left-3 right-3"
              : "bottom-[calc(100%-0.25rem)] left-3 right-3",
          )}
        >
          <p className="border-b border-[var(--color-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {portalLabel(role)} workspace
          </p>
          <Link
            href={profileHref}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
            onClick={() => setOpen(false)}
          >
            <User className="h-3.5 w-3.5" aria-hidden />
            {role === "admin" ? "Admin home" : "View profile"}
          </Link>
          {showCompanySwitch && activeBiz ? (
            <div className="border-t border-[var(--color-border)]">
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Company
              </p>
              {activeBiz.businesses.map((biz) => {
                const selected = activeBiz.business?.id === biz.id;
                return (
                  <button
                    key={biz.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--color-surface)]",
                      selected
                        ? "font-semibold text-[var(--color-accent-strong)]"
                        : "text-[var(--color-muted)]",
                    )}
                    onClick={() => {
                      void activeBiz.setActiveBusiness(biz.id);
                      setOpen(false);
                    }}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{biz.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {otherPortals.length > 0 && (
            <div className="border-t border-[var(--color-border)]">
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Switch workspace
              </p>
              {otherPortals.map((portal) => (
                <Link
                  key={portal}
                  href={portalHome(portal)}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
                  onClick={() => setOpen(false)}
                >
                  <PortalIcon portal={portal} />
                  {portalLabel(portal)}
                </Link>
              ))}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 border-t border-[var(--color-border)] px-3 py-2.5 text-left text-xs text-[var(--color-danger)] hover:bg-[var(--color-surface)] disabled:opacity-60"
            onClick={() => void onLogout()}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
          open ? "bg-white" : "hover:bg-white",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-border)]">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-[var(--color-accent-strong)]">
              {initials(user.displayName, user.email)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[var(--color-ink)]">{name}</span>
          {email ? (
            <span className="block truncate text-[10px] text-[var(--color-muted)]">{email}</span>
          ) : null}
        </span>
        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] transition-transform",
            open ? "rotate-0" : "rotate-180",
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
