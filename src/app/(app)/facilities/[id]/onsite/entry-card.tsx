"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "@/components/voice-button";
import { saveOnsiteEntry, type OnsiteEntryKind } from "@/lib/actions/onsite-entries";
import { draftKey, newSubmissionId, readDraft, removeDraft, writeDraft } from "./onsite-drafts";

const SAVE_LABEL: Record<OnsiteEntryKind, string> = { visit: "Save visit", staff: "Save conversation", family: "Save conversation" };
const SAVED_LABEL: Record<OnsiteEntryKind, string> = { visit: "Visit saved", staff: "Conversation saved", family: "Family support saved" };

/**
 * Record what happened with one person, right where they're listed:
 * type, or tap the microphone and talk -- both fill the same box, and
 * one Save makes it a real entry (this person, this facility, now, you).
 * The note is kept on this phone until the CRM confirms the save.
 */
export function EntryCard({
  facilityId,
  kind,
  personId,
  residentId,
  contactId,
  title,
  alreadyToday,
  onDone,
}: {
  facilityId: string;
  kind: OnsiteEntryKind;
  /** Whose draft this is (the resident for a visit, else the contact). */
  personId: string;
  residentId?: string;
  contactId?: string;
  /** "Visit with Sarah Sample · room 104" */
  title: string;
  /** Who already logged a visit with them today -- asked about first. */
  alreadyToday?: string[];
  onDone: () => void;
}) {
  const key = draftKey(facilityId, kind, personId);
  const [notes, setNotes] = useState("");
  const submissionId = useRef<string>("");
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmSecond, setConfirmSecond] = useState(false);
  const [saved, setSaved] = useState<{ id: string; time: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Pick up a note left unsaved earlier (closed tab, lost signal...).
  useEffect(() => {
    const draft = readDraft(key);
    submissionId.current = draft?.submissionId ?? newSubmissionId();
    if (!draft?.notes) return;
    const t = window.setTimeout(() => {
      setNotes(draft.notes);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [key]);

  // Keep every change on the phone until it's saved.
  const update = (next: string) => {
    setNotes(next);
    setError(null);
    writeDraft(key, { notes: next, submissionId: submissionId.current, updatedAt: Date.now() });
  };

  // Warn before leaving the page with a note not yet saved.
  useEffect(() => {
    if (saved || !notes.trim()) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [notes, saved]);

  function save(confirmed = false) {
    if (alreadyToday?.length && kind === "visit" && !confirmed) {
      setConfirmSecond(true);
      return;
    }
    setConfirmSecond(false);
    setError(null);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      return;
    }
    setOffline(false);
    startTransition(async () => {
      try {
        const result = await saveOnsiteEntry({
          kind,
          facilityId,
          residentId,
          contactId,
          notes: notes.trim() || undefined,
          submissionId: submissionId.current,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        removeDraft(key);
        setSaved({ id: result.interactionId, time: result.time });
      } catch {
        // No answer at all: most likely the connection dropped.
        setOffline(true);
      }
    });
  }

  if (saved) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-5 shrink-0" /> {SAVED_LABEL[kind]} at {saved.time}
        </p>
        <p className="text-muted-foreground">{title}. It&apos;s in the CRM.</p>
        <div className="flex gap-2">
          <Button className="h-11 flex-1" onClick={onDone}>Done — next</Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/interactions/${saved.id}/edit?from=onsite`}>Fix</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-primary/40 bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      {restored ? (
        <p className="text-xs font-medium text-[var(--tone-attention-fg)]">Your unsaved note from before is back. Check it, then Save.</p>
      ) : null}
      <textarea
        value={notes}
        onChange={(e) => update(e.target.value)}
        rows={3}
        placeholder="What happened? (optional) — type, or tap the microphone and talk"
        aria-label="What happened (optional)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
      />
      <VoiceButton compact label="Talk instead of typing" onText={(text) => update(notes.trim() ? `${notes.trim()} ${text}` : text)} />

      {confirmSecond ? (
        <div className="rounded-md border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm">
          <p className="font-medium text-[var(--tone-attention-fg)]">
            Already visited today{alreadyToday?.length ? ` (by ${alreadyToday.join(", ")})` : ""}. Is this a second visit?
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="h-11 flex-1" onClick={() => save(true)}>Yes, save it</Button>
            <Button variant="outline" className="h-11" onClick={() => setConfirmSecond(false)}>No</Button>
          </div>
        </div>
      ) : null}

      {offline ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--tone-attention-bg)] p-2 text-sm text-[var(--tone-attention-fg)]">
          <CloudOff className="mt-0.5 size-4 shrink-0" /> NOT saved yet — no connection. Your note is kept on this phone; tap Save again when you have signal.
        </p>
      ) : null}
      {error ? <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm font-medium text-destructive">{error}</p> : null}

      {confirmSecond ? null : (
        <div className="flex gap-2">
          <Button className="h-12 flex-1 text-base" onClick={() => save()} disabled={pending}>
            {pending ? <><Loader2 className="animate-spin" /> Saving…</> : SAVE_LABEL[kind]}
          </Button>
          <Button variant="ghost" className="h-12" onClick={onDone} disabled={pending}>
            {notes.trim() ? "Later" : "Cancel"}
          </Button>
        </div>
      )}
      {notes.trim() ? <p className="text-xs text-muted-foreground">&ldquo;Later&rdquo; keeps the note on this phone, unsaved.</p> : null}
    </div>
  );
}
