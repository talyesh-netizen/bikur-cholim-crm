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
  BellRing,
  ChartColumn,
  type LucideIcon,
  KeyRound,
} from "lucide-react";
import type { Section } from "@/lib/sections";

// Nav item data, kept separate from nav-links.tsx (a "use client"
// component file) so server components like more/page.tsx can call
// mobileMoreItems() directly -- a plain function can't be invoked from
// the server when it's exported out of a client module.

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: Section;
  /** Other paths that count as "this menu item" (e.g. People covers
   * Contacts and Shuls & Partners). */
  alsoActive?: string[];
};

// Kept short on purpose: the daily essentials, with everything else one
// tap deeper under People and Settings.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard, section: "dashboard" },
  { href: "/quick-log", label: "Quick Log", icon: Sparkles, section: "log" },
  { href: "/needs-attention", label: "Needs attention", icon: BellRing, section: "residents" },
  { href: "/residents", label: "Residents", icon: Users, section: "residents" },
  { href: "/facilities", label: "Facilities", icon: Building2, section: "facilities" },
  { href: "/interactions", label: "Interactions", icon: History, section: "log" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, section: "tasks" },
  { href: "/impact", label: "Impact", icon: ChartColumn, section: "dashboard" },
  { href: "/people", label: "People", icon: Contact, section: "contacts", alsoActive: ["/contacts", "/organizations"] },
  { href: "/settings", label: "Settings", icon: Settings, section: "neutral", alsoActive: ["/data-quality", "/settings/password"] },
];

/** What People opens. */
export const PEOPLE_ITEMS: NavItem[] = [
  { href: "/contacts", label: "Contacts", icon: Contact, section: "contacts" },
  { href: "/organizations", label: "Shuls & Partners", icon: Landmark, section: "contacts" },
];

/** What Settings opens for everyone. */
export const SETTINGS_ITEMS: NavItem[] = [
  { href: "/data-quality", label: "Data Quality", icon: ClipboardCheck, section: "neutral" },
  { href: "/settings/password", label: "Change password", icon: KeyRound, section: "neutral" },
];

/** What Settings also opens for admins. */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/settings/staff", label: "Staff", icon: Settings, section: "neutral" },
  { href: "/settings/backup", label: "Backup", icon: DatabaseBackup, section: "neutral" },
  { href: "/settings/changes", label: "Recent changes", icon: History, section: "neutral" },
];

// The sidebar has room for every item, but a phone's bottom bar gets
// cramped past ~5 icons (see the "cluttered on the bottom" feedback) --
// these are the ones worth a full-time slot there; everything else
// (Contacts, and Staff for admins) lives under "More" instead.
export const MOBILE_PRIMARY_HREFS = ["/dashboard", "/facilities", "/residents", "/interactions", "/tasks"];
export const MOBILE_MORE_ITEM: NavItem = { href: "/more", label: "More", icon: MoreHorizontal, section: "neutral" };

export function isActive(pathname: string, href: string, alsoActive: string[] = []) {
  if (href === "/dashboard") return pathname === href;
  return [href, ...alsoActive].some((h) => pathname.startsWith(h));
}

/** The nav items that don't get a full-time slot in the mobile bottom
 * bar -- shown on the /more page instead. */
export function mobileMoreItems({ quickLog = true }: { quickLog?: boolean } = {}) {
  return navItems({ quickLog }).filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
}

/** The menu, minus Quick Log while it isn't switched on. */
export function navItems({ quickLog = true }: { quickLog?: boolean } = {}) {
  return quickLog ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/quick-log");
}
