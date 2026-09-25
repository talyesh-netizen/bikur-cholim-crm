import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A titled section on a detail page or the dashboard -- one consistent
 * header layout (icon, title, optional count, optional "add" link) so
 * every page reads the same way. */
export function SectionCard({
  title,
  icon: Icon,
  count,
  action,
  className,
  children,
  id,
}: {
  title: string;
  icon?: LucideIcon;
  count?: number;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card className={className} id={id}>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
        <CardTitle className="text-base">
          {title}
          {typeof count === "number" && count > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">({count})</span>
          ) : null}
        </CardTitle>
        {action ? (
          <Button size="sm" variant="outline" asChild className={cn("ml-auto")}>
            <Link href={action.href}>
              <Plus />
              {action.label}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
