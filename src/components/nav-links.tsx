"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SectionIcon } from "@/components/section-icon";
import { sectionVars } from "@/lib/sections";
import {
  NAV_ITEMS,
  MOBILE_PRIMARY_HREFS,
  MOBILE_MORE_ITEM,
  isActive,
} from "@/lib/nav-items";

export function SidebarNavLinks() {
  const pathname = usePathname();
  const items = NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.alsoActive);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--tone-brand-bg)] font-semibold text-[var(--tone-brand-fg)]"
                : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <SectionIcon section={item.section} icon={item.icon} size="sm" />
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
  const moreIsActive = !primaryItems.some((item) => isActive(pathname, item.href, item.alsoActive));
  const items = [...primaryItems, MOBILE_MORE_ITEM];

  return (
    <nav className="flex items-stretch justify-between">
      {items.map((item) => {
        const active = item.href === "/more" ? moreIsActive : isActive(pathname, item.href, item.alsoActive);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium",
              active ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {/* The icon wears its section color; the active tab also gets
                a short bar in that color underneath, so "you are here"
                isn't told by color alone (the label turns bold too). */}
            <Icon className="size-5" style={{ color: sectionVars(item.section).fill }} />
            <span>{item.label}</span>
            <span
              aria-hidden
              className={cn("h-0.5 w-6 rounded-full", active ? "" : "invisible")}
              style={{ backgroundColor: sectionVars(item.section).fill }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
