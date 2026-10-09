"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Cookie, Flag, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickLog } from "../../../quick-log/quick-log";
import { ResidentDirectory, type DirectoryResident } from "./resident-directory";
import { StaffList, type OnsiteStaff } from "./staff-list";
import { TodayList, type LoggedToday } from "./today-list";
import type { OnsiteTab } from "@/lib/onsite-links";
import { cn } from "@/lib/utils";
import { endVisitSession } from "@/lib/visit-session";

/**
 * The on-site page's working area (decided Oct 9, 2026): three tabs --
 * Residents, Staff, Today -- with the one notes box and "Finish visit"
 * underneath, all on one page, so a round of visits never goes back and
 * forth between sections of the CRM. The facility stays chosen for
 * everything started here.
 */
export function OnsiteWorkspace({
  facilityId,
  facilityName,
  residents,
  notesOn,
  loggedToday,
  followUpsDue,
  staff,
  initialTab = "residents",
  openResidentId,
}: {
  facilityId: string;
  facilityName: string;
  residents: DirectoryResident[];
  notesOn: boolean;
  loggedToday: LoggedToday[];
  followUpsDue: number;
  staff: OnsiteStaff[];
  initialTab?: OnsiteTab;
  /** A resident to show opened on the Residents tab. */
  openResidentId?: string;
}) {
  const [tab, setTab] = useState<OnsiteTab>(initialTab);
  // "I saw them" on the Finish check: open that resident's visit.
  const [visitRequest, setVisitRequest] = useState<{ id: string; key: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [unsavedNote, setUnsavedNote] = useState(false);

  // The tab is kept in the address (without reloading), so coming back
  // from a form or the back button lands on the same tab.
  const chooseTab = (next: OnsiteTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === "residents") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      url.searchParams.delete("open");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The tab still changes; only the address doesn't.
    }
  };

  const visit = (r: DirectoryResident) => {
    chooseTab("residents");
    setFinishing(false);
    setVisitRequest((prev) => ({ id: r.id, key: (prev?.key ?? 0) + 1 }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

      <div role="tablist" aria-label="On site" className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 shadow-sm md:top-2">
        {([
          ["residents", "Residents", notSeen.length > 0 ? `${notSeen.length} to see` : "all seen"],
          ["staff", "Staff", String(staff.length)],
          ["today", "Today", String(loggedToday.length)],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => chooseTab(key)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-md px-1 text-sm font-medium",
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
            <span className="text-xs font-normal text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {tab === "residents" ? (
        <ResidentDirectory
          key={visitRequest?.key ?? 0}
          facilityId={facilityId}
          residents={residents}
          initiallyOpen={visitRequest?.id ?? openResidentId}
          initialVisit={!!visitRequest}
        />
      ) : tab === "staff" ? (
        <StaffList facilityId={facilityId} staff={staff} />
      ) : (
        <TodayList loggedToday={loggedToday} />
      )}

      {notesOn ? <QuickLog onSite={{ facilityId, facilityName }} /> : null}

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
                      <button type="button" className="ml-auto min-h-11 px-2 font-medium text-primary" onClick={() => visit(r)}>
                        I saw them
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              onClick={() => {
                chooseTab("today");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex min-h-11 items-center justify-between rounded-md border px-3 text-left font-medium"
            >
              <span>Check what was logged here today ({loggedToday.length})</span>
              <span className="text-primary">Today</span>
            </button>

            {/* Done ends this visit: Today stops offering to resume it. */}
            <Button size="lg" variant="outline" className="h-12 w-full text-base" asChild>
              <Link href="/dashboard" onClick={() => endVisitSession()}>Done — end this visit</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
