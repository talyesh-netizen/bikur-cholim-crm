"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ListPlus, X } from "lucide-react";
import { SAVED_MESSAGES, type SavedKind } from "@/lib/saved-flash";

/** Shows the "saved" confirmation carried by ?saved=... (see
 * lib/saved-flash.ts), then quietly strips it from the URL so a refresh
 * or a shared link doesn't show it again. */
export function SaveToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<{ kind: SavedKind; recordId: string | null; key: number } | null>(null);

  const saved = searchParams.get("saved");
  const savedId = searchParams.get("savedId");
  const validSaved = saved && saved in SAVED_MESSAGES ? (saved as SavedKind) : null;

  // Pick up a new ?saved= marker during render (React's recommended
  // pattern for deriving state from changing input, rather than an
  // effect that renders twice).
  const [seen, setSeen] = useState<string | null>(null);
  const marker = validSaved ? `${pathname}|${validSaved}|${savedId ?? ""}` : null;
  if (marker !== seen) {
    setSeen(marker);
    if (validSaved) setToast({ kind: validSaved, recordId: savedId, key: (toast?.key ?? 0) + 1 });
  }

  // Then tidy the address bar, so a refresh doesn't show it again.
  useEffect(() => {
    if (!saved) return;
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("saved");
    rest.delete("savedId");
    const query = rest.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [saved, pathname, router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), isLoggedInteraction(toast.kind) ? 9000 : 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const offerFollowUp = isLoggedInteraction(toast.kind) && toast.recordId;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div
        key={toast.key}
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-success/30 bg-card px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-4"
      >
        <CheckCircle2 className="size-5 shrink-0 text-success" />
        <p className="flex-1 text-sm font-medium">
          {SAVED_MESSAGES[toast.kind]}
          <span className="block text-xs font-normal text-muted-foreground">Saved just now</span>
        </p>
        {offerFollowUp ? (
          <Link
            href={`/tasks/new?interaction=${toast.recordId}`}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2.5 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent"
            onClick={() => setToast(null)}
          >
            <ListPlus className="size-4" />
            Add follow-up
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setToast(null)}
          className="-mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function isLoggedInteraction(kind: SavedKind) {
  return kind === "interaction-logged" || kind === "visit-logged";
}
