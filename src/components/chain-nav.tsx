import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Where a page sits in the one chain the department thinks in:
 * Healthcare group › Facility › Resident (decided Oct 8, 2026). Each
 * step above the current page is a link, so it's one tap up a level. */
export function ChainNav({ steps }: { steps: { label: string; href?: string }[] }) {
  const shown = steps.filter((s) => s.label);
  if (shown.length < 2) return null;
  return (
    <nav aria-label="Where this is" className="-mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {shown.map((s, i) => (
        <span key={`${s.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <ChevronRight aria-hidden className="size-3.5" /> : null}
          {s.href && i < shown.length - 1 ? (
            <Link href={s.href} className="hover:text-foreground hover:underline">
              {s.label}
            </Link>
          ) : (
            <span className={i === shown.length - 1 ? "text-foreground" : undefined}>{s.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
