import { Search, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { searchAll } from "@/lib/queries/search";
import type { SearchGroup } from "@/lib/queries/search";
import { cn } from "@/lib/utils";

function ResultGroup({ group }: { group: SearchGroup }) {
  return (
    <Card id={`group-${group.key}`} className="scroll-mt-20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {group.title} <span className="font-normal text-muted-foreground">({group.results.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {group.results.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className={cn(
              "flex min-h-12 items-center gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:text-primary",
              r.muted && "opacity-75"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{r.label}</span>
                {r.date ? <span className="text-xs text-muted-foreground">{r.date}</span> : null}
              </span>
              {r.sublabel ? <span className="block text-xs text-muted-foreground">{r.sublabel}</span> : null}
              {r.snippet ? <span className="mt-0.5 block text-xs italic text-muted-foreground">{r.snippet}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {group.moreHref ? (
          <Link href={group.moreHref} className="pt-2.5 text-sm font-medium text-primary">
            See all matching activity
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const groups = query.length > 0 ? await searchAll(query) : null;
  const totalCount = groups ? groups.reduce((n, g) => n + g.results.length, 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        {query ? (
          <p className="text-sm text-muted-foreground">
            {totalCount} result{totalCount === 1 ? "" : "s"} for &quot;{query}&quot;
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Search everything: people, facilities, partners, visits and programs, tasks (done ones too), and notes.
          </p>
        )}
      </div>

      {groups && totalCount === 0 ? (
        <EmptyState
          icon={Search}
          title={`No matches for "${query}"`}
          description="Try one word, a different spelling, just a last name, or part of a facility name."
        />
      ) : null}

      {/* With several groups, a row of shortcuts so a phone doesn't
          scroll past residents to reach the activity. */}
      {groups && groups.length > 2 ? (
        <nav aria-label="Jump to" className="-mx-1 flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <a
              key={g.key}
              href={`#group-${g.key}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {g.title.replace(/ \(.*\)$/, "")} · {g.results.length}
            </a>
          ))}
        </nav>
      ) : null}

      {groups?.map((g) => <ResultGroup key={g.key} group={g} />)}
    </div>
  );
}
