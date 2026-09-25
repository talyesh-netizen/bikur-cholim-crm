"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  ADMIN_NAV_ITEM,
  MOBILE_PRIMARY_HREFS,
  MOBILE_MORE_ITEM,
  isActive,
} from "@/lib/nav-items";

export function SidebarNavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : undefined)} />
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
    <div className="flex items-stretch justify-between px-1">
      {items.map((item) => {
        const active = item.href === "/more" ? moreIsActive : isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium leading-tight",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                active ? "bg-tone-brand-bg" : undefined
              )}
            >
              <Icon className="size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
