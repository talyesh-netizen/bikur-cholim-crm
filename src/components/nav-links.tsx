"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Contact,
  ListChecks,
  History,
  Settings,
  Landmark,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/residents", label: "Residents", icon: Users },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/organizations", label: "Shuls & Partners", icon: Landmark },
  { href: "/interactions", label: "Interactions", icon: History },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];

const ADMIN_NAV_ITEM = { href: "/settings/staff", label: "Staff", icon: Settings };

// The sidebar has room for every item, but a phone's bottom bar gets
// cramped past ~5 icons (see the "cluttered on the bottom" feedback) --
// these are the ones worth a full-time slot there; everything else
// (Contacts, and Staff for admins) lives under "More" instead.
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/facilities", "/residents", "/interactions", "/tasks"];
const MOBILE_MORE_ITEM = { href: "/more", label: "More", icon: MoreHorizontal };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNavLinks() {
  const pathname = usePathname();
  const primaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
  const moreIsActive = !primaryItems.some((item) => isActive(pathname, item.href));
  const items = [...primaryItems, MOBILE_MORE_ITEM];

  return (
    <nav className="flex items-stretch justify-between">
      {items.map((item) => {
        const active = item.href === "/more" ? moreIsActive : isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The nav items that don't get a full-time slot in the mobile bottom
 * bar -- shown on the /more page instead. */
export function mobileMoreItems(isAdmin: boolean) {
  const secondary = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
  return isAdmin ? [...secondary, ADMIN_NAV_ITEM] : secondary;
}
