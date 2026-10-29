"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Pages that are themselves a log or edit form -- nothing to come back to.
const NO_RETURN = /^\/(interactions\/new|quick-log)|\/edit$/;

/** Where "+ Log" goes: always a blank form (director, Oct 27, 2026 QA,
 * decision A) -- it never fills in whoever's page is open. A person's
 * page has its own "Log with [name]" button for that. Without Quick Log,
 * the form comes back to this page after saving. */
export function logHref(pathname: string, quickLog: boolean): string {
  const base = quickLog ? "/quick-log" : "/interactions/new";
  if (!quickLog && pathname !== "/" && !NO_RETURN.test(pathname)) {
    return `${base}?back=${encodeURIComponent(pathname)}`;
  }
  return base;
}

/** The one way to log anything (decided Oct 8, 2026): a single red
 * "+ Log" button on every page. On a computer it opens the standard
 * form (director, Oct 21, 2026); Quick Log stays one link away on the
 * form, and is still what the phone's button opens. */
export function LogButton({ quickLog, className }: { quickLog: boolean; className?: string }) {
  const pathname = usePathname();
  return (
    <Button asChild className={cn("h-10 gap-1.5 px-4 text-base font-semibold", className)}>
      <Link href={logHref(pathname, quickLog)}>
        <Plus className="size-5" />
        Log
      </Link>
    </Button>
  );
}
