import { cn } from "@/lib/utils";

/** A short row of "at a glance" facts at the top of a detail page
 * (last visit, next follow-up, open tasks...). Two per row on a phone,
 * so the most important dates are readable without scrolling. */
export function KeyFacts({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-3 gap-2", className)}>{children}</dl>;
}

export function KeyFact({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  /** "attention" tints the value -- e.g. an overdue follow-up. */
  emphasis?: "attention" | "urgent";
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/70 px-2.5 py-2.5 sm:px-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold leading-snug",
          emphasis === "attention" && "text-tone-attention-fg",
          emphasis === "urgent" && "text-destructive"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
