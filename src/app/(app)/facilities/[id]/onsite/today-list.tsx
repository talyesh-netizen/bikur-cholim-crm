import Link from "next/link";
import { NotebookPen, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type LoggedToday = {
  id: string;
  what: string;
  who: string | null;
  time: string;
  by: string | null;
  /** "Add to facility profile" (QA-006): set for a conversation with a
   * note that isn't about a resident. */
  profileHref: string | null;
};

/** On-site Today tab: everything logged at this facility today, by
 * anyone, newest first -- to check what was saved and fix a mistake
 * (Fix opens the entry and comes back here). */
export function TodayList({ loggedToday }: { loggedToday: LoggedToday[] }) {
  const counts = new Map<string, number>();
  for (const x of loggedToday) {
    const kind = x.what.replace(/ \(\d+\)$/, "");
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Logged here today</CardTitle>
        {loggedToday.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {[...counts.entries()].map(([kind, n]) => `${n} ${kind.toLowerCase()}`).join(" · ")}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {loggedToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged here yet today.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {loggedToday.map((x) => (
              <li key={x.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-16 shrink-0 text-muted-foreground">{x.time}</span>
                <Link href={`/interactions/${x.id}`} className="min-w-0 flex-1">
                  <span className="block font-medium">{x.what}{x.who ? ` · ${x.who}` : ""}</span>
                  {x.by ? <span className="block text-xs text-muted-foreground">by {x.by}</span> : null}
                </Link>
                {x.profileHref ? (
                  <Link href={x.profileHref} className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs text-muted-foreground">
                    <NotebookPen className="size-4" /> To profile
                  </Link>
                ) : null}
                <Link
                  href={`/interactions/${x.id}/edit?from=onsite`}
                  className="flex min-h-11 shrink-0 items-center gap-1 px-2 font-medium text-primary"
                >
                  <Pencil className="size-4" /> Fix
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
