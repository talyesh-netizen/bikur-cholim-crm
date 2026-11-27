"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuickStatusState } from "@/lib/actions/residents";
import { BedDouble, Home, Flower2 } from "lucide-react";

type Action = (state: QuickStatusState, formData: FormData) => Promise<QuickStatusState>;

/** In hospital / Back at [facility] / Passed away, one tap each from the
 * resident's page (Nov 27, 2026). Passed away is confirmed once, with an
 * optional date. */
export function QuickStatus({
  status,
  facilityName,
  inHospital,
  back,
  deceased,
  openFollowUps = 0,
}: {
  status: string;
  facilityName: string | null;
  inHospital: Action;
  back: Action;
  deceased: Action;
  /** Their open follow-ups, offered for closing (Nov 27, 2026). */
  openFollowUps?: number;
}) {
  const [hospitalState, hospitalAction, hospitalPending] = useActionState(inHospital, { error: null });
  const [backState, backAction, backPending] = useActionState(back, { error: null });
  const [deceasedState, deceasedAction, deceasedPending] = useActionState(deceased, { error: null });
  const [confirming, setConfirming] = useState(false);
  const error = hospitalState.error ?? backState.error ?? deceasedState.error;
  if (status === "deceased") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "temporarily_hospitalized" ? (
          <form action={backAction}>
            <Button type="submit" variant="outline" size="sm" disabled={backPending}>
              <Home className="size-4" /> {backPending ? "Saving…" : `Back at ${facilityName ?? "their home"}`}
            </Button>
          </form>
        ) : (
          <form action={hospitalAction}>
            <Button type="submit" variant="outline" size="sm" disabled={hospitalPending}>
              <BedDouble className="size-4" /> {hospitalPending ? "Saving…" : "In hospital"}
            </Button>
          </form>
        )}
        {!confirming ? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)}>
            <Flower2 className="size-4" /> Passed away
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <form action={deceasedAction} className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Mark as passed away?</p>
          <p className="text-muted-foreground">
            They come off current rosters and visit lists. Their profile and full history are kept.
          </p>
          {openFollowUps > 0 ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs text-muted-foreground">
                {openFollowUps} open follow-up{openFollowUps === 1 ? "" : "s"}
              </legend>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="followups" value="close" defaultChecked className="size-4" />
                Close {openFollowUps === 1 ? "it" : "them"}
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="followups" value="keep" className="size-4" />
                Keep {openFollowUps === 1 ? "it" : "them"} open for family follow-up
              </label>
            </fieldset>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="date_of_death" className="text-xs text-muted-foreground">Date (optional)</Label>
            <Input id="date_of_death" name="date_of_death" type="date" className="w-fit" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={deceasedPending}>
              {deceasedPending ? "Saving…" : "Yes, mark as passed away"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
