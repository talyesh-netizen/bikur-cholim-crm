import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUnreviewedCountsByType, listUnreviewedEntries, REVIEW_PAGE_SIZE } from "@/lib/queries/data-quality";
import { INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, RotateCw } from "lucide-react";
import { ReviewRow } from "./review-row";

export default async function ReviewEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const type = INTERACTION_TYPES.some((t) => t.value === typeParam) ? typeParam : undefined;

  const [counts, entries] = await Promise.all([getUnreviewedCountsByType(), listUnreviewedEntries(type)]);
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const shownCount = type ? (counts.find((c) => c.type === type)?.count ?? 0) : total;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/data-quality">
            <ArrowLeft className="size-4" />
            Back to data quality
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Review past entries</h1>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Every past entry has been reviewed."
            : `${total.toLocaleString("en-US")} entries logged before the new service types still to review. Read the notes, fix the type if it's wrong (for example "Other" that was really a ride), and tap "Looks right" or "Save change". Start with "Other" — that's where most services ended up.`}
        </p>
      </div>

      {counts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/data-quality/review-entries" active={!type} label="All" count={total} />
          {counts
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((c) => (
              <FilterChip
                key={c.type}
                href={`/data-quality/review-entries?type=${c.type}`}
                active={type === c.type}
                label={labelFor(INTERACTION_TYPES, c.type)}
                count={c.count}
              />
            ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Nothing left to review here.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => (
            <ReviewRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      {shownCount > REVIEW_PAGE_SIZE ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">
            Showing {REVIEW_PAGE_SIZE} of {shownCount.toLocaleString("en-US")}. When you finish these, load the next batch.
          </p>
          <Button variant="outline" size="sm" asChild>
            {/* A plain link (full reload) so the batch is always re-fetched fresh. */}
            <a href={type ? `/data-quality/review-entries?type=${type}` : "/data-quality/review-entries"}>
              <RotateCw className="size-4" />
              Load next batch
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
      )}
    >
      {label} <span className={active ? "opacity-80" : "text-muted-foreground"}>{count.toLocaleString("en-US")}</span>
    </Link>
  );
}
