import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** What a section shows when it has nothing in it yet: what that means,
 * and (when there's an obvious next step) a way to take it. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center",
        className
      )}
    >
      <Icon className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? (
        <Link href={action.href} className="mt-1 text-sm font-medium text-primary hover:underline">
          {action.label} &rarr;
        </Link>
      ) : null}
    </div>
  );
}
