"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Cookie, Flag, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickLog } from "../../../quick-log/quick-log";
import { ResidentDirectory, type DirectoryResident } from "./resident-directory";

export type LoggedToday = { id: string; what: string; who: string | null; time: string; by: string | null };

/**
 * The on-site page's working area (decided Oct 9, 2026): the residents,
 * the one notes box, and "Finish visit" -- all on one page, so a round
 * of visits never goes back and forth.
 */
export function OnsiteWorkspace({
  facilityId,
  facilityName,
  residents,
  notesOn,
  loggedToday,
  followUpsDue,
}: {
  facilityId: string;
  facilityName: string;
  residents: DirectoryResident[];
  notesOn: boolean;
  loggedToday: LoggedToday[];
  followUpsDue: number;
}) {
  const [line, setLine] = useState<{ text: string; key: number } | undefined>(undefined);
  const [finishing, setFinishing] = useState(false);
  const [unsavedNote, setUnsavedNote] = useState(false);

  const visit = (r: DirectoryResident) =>
    setLine((prev) => ({ text: `Visited ${r.name}${r.room ? ` (room ${r.room})` : ""}. `, key: (prev?.key ?? 0) + 1 }));

  const finish = () => {
    // A note still in the box (kept on this phone until it's saved).
    try {
      setUnsavedNote(!!window.localStorage.getItem(`quick-log-draft:${facilityId}`)?.trim());
    } catch {
      setUnsavedNote(false);
    }
    setFinishing(true);
    window.setTimeout(() => document.getElementById("finish-visit")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const seen = residents.filter((r) => r.seenToday);
  const notSeen = residents.filter((r) => !r.seenToday);
  const toCheck = (unsavedNote ? 1 : 0) + (followUpsDue > 0 ? 1 : 0);

  return (
    <>
      <Button variant="outline" className="h-12 w-full justify-start gap-2 text-base" asChild>
        <Link href={`/interactions/new?facility=${facilityId}&type=food_delivery&from=onsite`}>
          <Cookie className="size-5" /> Food today
          <span className="ml-auto text-sm font-normal text-muted-foreground">counted once for {facilityName}</span>
        </Link>
      </Button>

      <ResidentDirectory facilityId={facilityId} residents={residents} onVisit={notesOn ? visit : undefined} />

      {notesOn ? <QuickLog onSite={{ facilityId, facilityName }} addLine={line} /> : null}

      <Button size="lg" variant={finishing ? "outline" : "default"} className="h-12 w-full text-base" onClick={finish}>
        <Flag /> Finish visit
      </Button>

      {finishing ? (
        <Card id="finish-visit" className="scroll-mt-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Before you go</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only what was logged counts. No one is marked as visited unless a visit with them was saved.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 text-sm">
            <section>
              <h3 className="mb-2 font-semibold">Still to check {toCheck > 0 ? `(${toCheck})` : ""}</h3>
              {toCheck === 0 ? (
                <p className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" /> Nothing left unsaved.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {unsavedNote ? (
                    <li className="rounded-md border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-[var(--tone-attention-fg)]">
                      Your note isn&apos;t saved yet. Tap <span className="font-medium">Read my note</span>, check it, then Save.
                    </li>
                  ) : null}
                  {followUpsDue > 0 ? (
                    <li className="rounded-md border p-3">
                      <ListChecks className="mr-1.5 inline size-4" />
                      {followUpsDue} follow-up{followUpsDue === 1 ? "" : "s"} due here (top of this page).
                    </li>
                  ) : null}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Seen today ({seen.length})</h3>
              {seen.length === 0 ? (
                <p className="text-muted-foreground">No visits saved here today yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {seen.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <Link href={`/residents/${r.id}`} className="hover:underline">{r.name}</Link>
                      {r.room ? <span className="text-muted-foreground">· {r.room}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Not seen today ({notSeen.length})</h3>
              {notSeen.length === 0 ? (
                <p className="text-muted-foreground">Everyone here was seen today.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {notSeen.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                      <span>{r.name}</span>
                      {r.room ? <span className="text-muted-foreground">· {r.room}</span> : null}
                      {notesOn ? (
                        <button type="button" className="ml-auto min-h-11 px-2 font-medium text-primary" onClick={() => visit(r)}>
                          I saw them
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Logged here today ({loggedToday.length})</h3>
              {loggedToday.length === 0 ? (
                <p className="text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {loggedToday.map((x) => (
                    <li key={x.id} className="flex gap-2">
                      <span className="w-16 shrink-0 text-muted-foreground">{x.time}</span>
                      <Link href={`/interactions/${x.id}`} className="min-w-0 hover:underline">
                        {x.what}
                        {x.who ? ` · ${x.who}` : ""}
                        {x.by ? <span className="text-muted-foreground"> · {x.by}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Button size="lg" variant="outline" className="h-12 w-full text-base" asChild>
              <Link href="/dashboard">Done</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
