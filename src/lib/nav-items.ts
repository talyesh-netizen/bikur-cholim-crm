import {
  LayoutDashboard,
  Building2,
  Users,
  Contact,
  ListChecks,
  History,
  Settings,
  Landmark,
  ClipboardCheck,
  MoreHorizontal,
  DatabaseBackup,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "@/lib/sections";

// Nav item data, kept separate from nav-links.tsx (a "use client"
// component file) so server components like more/page.tsx can call
// mobileMoreItems() directly -- a plain function can't be invoked from
// the server when it's exported out of a client module.

export type NavItem = { href: string; label: string; icon: LucideIcon; section: Section };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { href: "/quick-log", label: "Quick Log", icon: Sparkles, section: "log" },
  { href: "/facilities", label: "Facilities", icon: Building2, section: "facilities" },
  { href: "/residents", label: "Residents", icon: Users, section: "residents" },
  { href: "/contacts", label: "Contacts", icon: Contact, section: "contacts" },
  { href: "/organizations", label: "Shuls & Partners", icon: Landmark, section: "contacts" },
  { href: "/interactions", label: "Interactions", icon: History, section: "log" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, section: "tasks" },
  { href: "/data-quality", label: "Data Quality", icon: ClipboardCheck, section: "neutral" },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/settings/staff", label: "Staff", icon: Settings, section: "neutral" },
  { href: "/settings/backup", label: "Backup", icon: DatabaseBackup, section: "neutral" },
];

// The sidebar has room for every item, but a phone's bottom bar gets
// cramped past ~5 icons (see the "cluttered on the bottom" feedback) --
// these are the ones worth a full-time slot there; everything else
// (Contacts, and Staff for admins) lives under "More" instead.
export const MOBILE_PRIMARY_HREFS = ["/dashboard", "/facilities", "/residents", "/interactions", "/tasks"];
export const MOBILE_MORE_ITEM: NavItem = { href: "/more", label: "More", icon: MoreHorizontal, section: "neutral" };

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/** The nav items that don't get a full-time slot in the mobile bottom
 * bar -- shown on the /more page instead. */
export function mobileMoreItems(isAdmin: boolean) {
  const secondary = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
  return isAdmin ? [...secondary, ...ADMIN_NAV_ITEMS] : secondary;
}
