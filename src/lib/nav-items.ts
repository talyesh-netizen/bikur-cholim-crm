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
  type LucideIcon,
} from "lucide-react";

// Nav item data, kept separate from nav-links.tsx (a "use client"
// component file) so server components like more/page.tsx can call
// mobileMoreItems() directly -- a plain function can't be invoked from
// the server when it's exported out of a client module.

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/residents", label: "Residents", icon: Users },
  { href: "/interactions", label: "Interactions", icon: History },
  { href: "/tasks", label: "Follow-up tasks", icon: ListChecks },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/organizations", label: "Shuls & Partners", icon: Landmark },
  { href: "/data-quality", label: "Data Quality", icon: ClipboardCheck },
];

export const ADMIN_NAV_ITEM = { href: "/settings/staff", label: "Staff", icon: Settings };

// The sidebar has room for every item, but a phone's bottom bar gets
// cramped past ~5 icons (see the "cluttered on the bottom" feedback) --
// these four are the onsite workflow (find a facility or resident,
// review history); everything else (Tasks, Contacts, Staff for admins)
// lives under "More", and open tasks are front and center on the
// Dashboard anyway. Creating things lives in the header's "New" button.
export const MOBILE_PRIMARY_HREFS = ["/dashboard", "/facilities", "/residents", "/interactions"];
export const MOBILE_MORE_ITEM = { href: "/more", label: "More", icon: MoreHorizontal };

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/** The nav items that don't get a full-time slot in the mobile bottom
 * bar -- shown on the /more page instead. */
export function mobileMoreItems(isAdmin: boolean) {
  const secondary = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
  return isAdmin ? [...secondary, ADMIN_NAV_ITEM] : secondary;
}
