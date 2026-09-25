import { Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { searchAll } from "@/lib/queries/search";
import type { SearchResult } from "@/lib/queries/search";

function ResultGroup({ title, results }: { title: string; results: SearchResult[] }) {
  if (results.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} ({results.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {results.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:text-primary"
          >
            <span className="font-medium">{r.label}</span>
            {r.sublabel ? <span className="text-xs text-muted-foreground">{r.sublabel}</span> : null}
          </Link>
        ))}
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
  const results = query.length > 0 ? await searchAll(query) : null;
  const totalCount = results
    ? results.residents.length + results.facilities.length + results.contacts.length + results.organizations.length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        {query ? (
          <p className="text-sm text-muted-foreground">
            {totalCount} result{totalCount === 1 ? "" : "s"} for &quot;{query}&quot;
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Search residents, facilities, contacts, and organizations.</p>
        )}
      </div>

      {results && totalCount === 0 ? (
        <EmptyState
          icon={Search}
          title={`No matches for "${query}"`}
          description="Try a different spelling, just a last name, or part of the facility name."
        />
      ) : null}

      {results ? (
        <>
          <ResultGroup title="Residents" results={results.residents} />
          <ResultGroup title="Facilities" results={results.facilities} />
          <ResultGroup title="Contacts" results={results.contacts} />
          <ResultGroup title="Shuls & Partners" results={results.organizations} />
        </>
      ) : null}
    </div>
  );
}
