import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { ChainNav } from "@/components/chain-nav";
import { listDoubleEntries } from "@/lib/queries/double-entries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { INTERACTION_TYPES } from "@/lib/domain/interaction";
import { formatDateTime } from "@/lib/format-date";
import { PairList, UndoReviewButton } from "./pair-row";

/** Possible double entries: same kind, same person, same day. Each pair
 * waits for an admin's answer; nothing is decided automatically. */
export default async function DoubleEntriesPage() {
  const [{ open, reviewed }, profile] = await Promise.all([listDoubleEntries(), getCurrentProfile()]);
  const canReview = profile?.role === "admin";
  if (!canReview) redirect("/data-quality");

  return (
    <div className="flex flex-col gap-4">
      <ChainNav steps={[{ label: "Data Quality", href: "/data-quality" }, { label: "Possible double entries" }]} />
      <div>
        <h1 className="text-2xl font-semibold">Possible double entries</h1>
        <p className="text-sm text-muted-foreground">
          The same kind of entry, with the same person, on the same day — often one visit saved by each staff member who was
          there. &ldquo;Same visit&rdquo; counts it once in reports (by the day it happened) and keeps both people credited.
          Also one staff meeting saved once per person met (same facility, time and note): &ldquo;Same meeting&rdquo;
          counts one meeting and keeps everyone met on it. Nothing is deleted, and every answer can be undone.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">To review</CardTitle>
          {open.length > 0 ? <Badge variant="warning">{open.length}</Badge> : null}
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Nothing to review.</span>
            </div>
          ) : (
            <PairList
              pairs={open}
              typeLabels={Object.fromEntries(INTERACTION_TYPES.map((t) => [t.value, t.label]))}
              canReview={canReview}
            />
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col text-sm">
              {reviewed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                  <span>
                    <Link href={`/interactions/${r.kept_id}`} className="font-medium hover:underline">
                      {r.label}
                    </Link>{" "}
                    · {r.decision === "same" ? "Same visit (counted once)" : "Separate visits"}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {r.decided_by ?? "admin"}, {formatDateTime(r.decided_at)}
                    </span>
                  </span>
                  {canReview ? <UndoReviewButton reviewId={r.id} /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
