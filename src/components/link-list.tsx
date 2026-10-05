import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SectionIcon } from "@/components/section-icon";
import type { NavItem } from "@/lib/nav-items";
import { ChevronRight } from "lucide-react";

/** A plain list of big tappable rows -- used by People, Settings and More. */
export function LinkList({ items, descriptions = {} }: { items: NavItem[]; descriptions?: Record<string, string> }) {
  return (
    <Card>
      <CardContent className="flex flex-col p-0 sm:p-0">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-accent"
          >
            <SectionIcon section={item.section} icon={item.icon} />
            <span className="flex flex-1 flex-col">
              <span className="text-base font-medium">{item.label}</span>
              {descriptions[item.href] ? (
                <span className="text-sm text-muted-foreground">{descriptions[item.href]}</span>
              ) : null}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
