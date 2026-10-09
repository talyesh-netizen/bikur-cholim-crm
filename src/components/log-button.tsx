"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RESIDENT_PAGE = new RegExp(`^/residents/(${UUID})`, "i");
const FACILITY_PAGE = new RegExp(`^/facilities/(${UUID})`, "i");

/** Where "+ Log" goes from this page: the notes box, already set to the
 * resident or facility you're looking at. Without Quick Log, the form. */
export function logHref(pathname: string, quickLog: boolean): string {
  const base = quickLog ? "/quick-log" : "/interactions/new";
  const resident = pathname.match(RESIDENT_PAGE)?.[1];
  if (resident) return `${base}?resident=${resident}`;
  const facility = pathname.match(FACILITY_PAGE)?.[1];
  if (facility) return `${base}?facility=${facility}`;
  return base;
}

/** The one way to log anything (decided Oct 8, 2026): a single red
 * "+ Log" button on every page. */
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
