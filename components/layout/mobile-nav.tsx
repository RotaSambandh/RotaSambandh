"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  Megaphone,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { useAuth } from "@/components/auth/auth-provider";
import { useUnreadNotificationCount } from "@/components/notifications/notification-tray";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const candidateNavBase: Omit<NavItem, "badge">[] = [
  { href: "/candidate", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/candidate/applications", label: "Applications", icon: ClipboardList },
  { href: "/candidate/notifications", label: "Notifications", icon: Bell },
  { href: "/candidate/profile", label: "Profile", icon: User },
];

const employerNavBase: Omit<NavItem, "badge">[] = [
  { href: "/employer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employer/jobs", label: "Jobs", icon: Briefcase },
  { href: "/employer/company", label: "Company", icon: Building2 },
  { href: "/employer/notifications", label: "Notifications", icon: Bell },
  { href: "/employer/profile", label: "Profile", icon: User },
];

function useAdminNavItems(): NavItem[] {
  const { canWrite, isSuperAdmin } = usePlatformAccess();
  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/businesses", label: "Businesses", icon: Building2 },
    { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
    { href: "/admin/users", label: "Users", icon: Users },
  ];
  if (canWrite) {
    items.push({ href: "/admin/announcements", label: "Announce", icon: Megaphone });
    items.push({ href: "/admin/settings", label: "Settings", icon: Settings });
  }
  if (isSuperAdmin) {
    items.push({ href: "/admin/staff", label: "Staff", icon: Shield });
  }
  return items;
}

function withAlertsBadge(items: NavItem[], alertsHref: string, unread: number): NavItem[] {
  return items.map((item) =>
    item.href === alertsHref ? { ...item, badge: unread > 0 ? unread : undefined } : item,
  );
}

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        compact
          ? "font-nav relative flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] leading-tight"
          : "font-nav relative flex items-center gap-2 rounded-md px-3 py-2.5 text-xs",
        active
          ? "bg-[var(--color-accent-soft)] font-bold text-[var(--color-accent-strong)] shadow-sm ring-1 ring-[var(--color-accent)]/15"
          : compact
            ? "text-[var(--color-muted)]"
            : "text-[var(--color-ink)] hover:bg-white",
      )}
    >
      <span className="relative">
        <Icon className={compact ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
        {item.badge ? (
          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-0.5 text-[9px] font-semibold text-white">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        ) : null}
      </span>
      {item.label}
    </Link>
  );
}

export function MobileNav({ role }: { role: "candidate" | "employer" | "admin" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const unread = useUnreadNotificationCount(user?.uid);
  const adminItems = useAdminNavItems();
  const items =
    role === "employer"
      ? withAlertsBadge(employerNavBase, "/employer/notifications", unread)
      : role === "admin"
        ? withAlertsBadge(adminItems, "/admin/notifications", unread)
        : withAlertsBadge(candidateNavBase, "/candidate/notifications", unread);
  const cols =
    items.length >= 6 ? "grid-cols-6" : items.length >= 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav
      aria-label={`${role} mobile`}
      className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur"
    >
      <ul className={`mx-auto grid max-w-lg ${cols} gap-1 px-1 py-2`}>
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/candidate" &&
              item.href !== "/employer" &&
              item.href !== "/admin" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <NavLink item={item} active={active} compact />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopSideNav({ role }: { role: "candidate" | "employer" | "admin" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const unread = useUnreadNotificationCount(user?.uid);
  const adminItems = useAdminNavItems();
  const items =
    role === "employer"
      ? withAlertsBadge(employerNavBase, "/employer/notifications", unread)
      : role === "admin"
        ? withAlertsBadge(adminItems, "/admin/notifications", unread)
        : withAlertsBadge(candidateNavBase, "/candidate/notifications", unread);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)] md:flex md:flex-col">
      <div className="sticky top-0 flex min-h-screen flex-col">
        <div className="flex-1 p-4">
          <p className="mb-5 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-circle-64.webp" alt="" width={28} height={28} className="rounded-full" />
            Rota<span className="text-[var(--color-accent)]">Sambandh</span>
          </p>
          <p className="mb-2 px-3 text-overline text-[var(--color-muted)]">
            {role === "admin" ? "Staff" : role === "employer" ? "Employer" : "Member"}
          </p>
          <nav aria-label={`${role} desktop`}>
            <ul className="space-y-1">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/candidate" &&
                    item.href !== "/employer" &&
                    item.href !== "/admin" &&
                    pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    <NavLink item={item} active={active} />
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <SidebarAccount role={role} />
      </div>
    </aside>
  );
}
