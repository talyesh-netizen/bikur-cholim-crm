import { ChevronDown } from "lucide-react";

/** A quiet section that opens when tapped: one line with a title and an
 * optional count, the content underneath. Plain <details>, so it works
 * without JavaScript and with the keyboard. */
export function Fold({
  title,
  count,
  open = false,
  action,
  children,
}: {
  title: string;
  count?: number;
  open?: boolean;
  /** A button shown at the top of the opened section (e.g. "Add task"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rounded-xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-base font-semibold">
          {title}
          {count !== undefined ? <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span> : null}
        </span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">
        {action ? <div>{action}</div> : null}
        {children}
      </div>
    </details>
  );
}
