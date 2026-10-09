"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileNote } from "@/lib/actions/profile-notes";
import { formatDateTime } from "@/lib/format-date";
import type { ProfileNote } from "@/lib/queries/profile-notes";

export function ProfileNotesCard({
  targetType,
  targetId,
  notes,
  compact = false,
}: {
  targetType: "resident" | "facility";
  targetId: string;
  notes: ProfileNote[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveProfileNote(targetType, targetId, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.cleanNote);
      setNote("");
      if (compact) setOpen(false);
      router.refresh();
    });
  };

  const composer = open ? (
    <div className="flex flex-col gap-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          targetType === "resident"
            ? "Something worth remembering, e.g. “Hard of hearing, sit on her left” or “Daughter Sarah visits Sundays”."
            : "Something worth remembering, e.g. “Sign in at the front desk” or “Jen is the new activities director”."
        }
        rows={compact ? 3 : 4}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size={compact ? "sm" : "default"} onClick={save} disabled={pending || !note.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? "Cleaning & saving…" : "Clean & save"}
        </Button>
        {compact ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        For lasting facts that stay true. What happened on a particular visit or call goes in that visit&apos;s notes
        instead, and anything still to do is a follow-up task.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  ) : (
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
      <MessageSquarePlus className="size-4" />
      {targetType === "resident" ? "Add a note about them" : "Add facility note"}
    </Button>
  );

  const list =
    notes.length > 0 ? (
      <ol className="flex flex-col divide-y divide-border border-t border-border">
        {notes.map((item) => (
          <li key={item.id} className="py-3 first:pt-3">
            <p className="text-sm">{item.clean_note}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(item.created_at)}
              {item.created_by_name ? " · " + item.created_by_name : ""}
            </p>
            {item.raw_note.trim() !== item.clean_note.trim() ? (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Original wording</summary>
                <p className="mt-1 whitespace-pre-wrap">{item.raw_note}</p>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    ) : null;

  if (compact) {
    // Saved notes are listed here too -- the resident page uses the
    // compact form inside its "About them" section.
    return (
      <div className="mt-3 flex flex-col gap-3">
        {composer}
        {saved ? (
          <p className="flex items-start gap-1.5 text-xs text-success">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            Saved: {saved}
          </p>
        ) : null}
        {list}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Profile notes</CardTitle>
        <span className="text-xs text-muted-foreground">
          {notes.length ? notes.length + " recent" : "No notes yet"}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {composer}

        {saved ? (
          <p className="flex items-start gap-1.5 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            Saved: {saved}
          </p>
        ) : null}

        {notes.length > 0 ? (
          list
        ) : (
          <p className="text-sm text-muted-foreground">No profile notes have been added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
