"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The save area at the bottom of every create/edit form.
 *
 * - On a phone it sticks to the bottom of the screen (just above the
 *   bottom nav), so "Save" is always one tap away on a long form.
 * - While saving, the button is disabled and shows a spinner -- a second
 *   tap can't create a duplicate record.
 * - It also guards against losing typed-in information: once anything in
 *   the form has been changed, leaving the page (tapping a nav link,
 *   closing the tab, pressing back) asks for confirmation first.
 */
export function FormActions({
  isPending,
  submitLabel,
  savingLabel = "Saving…",
  disabled = false,
  hasUnsavedError = false,
}: {
  isPending: boolean;
  submitLabel: string;
  savingLabel?: string;
  disabled?: boolean;
  /** True when the last save attempt came back with an error -- what's
   * on screen still hasn't been saved, so leaving should still warn. */
  hasUnsavedError?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useUnsavedChangesGuard(ref, hasUnsavedError);

  return (
    <div
      ref={ref}
      className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 mt-2 flex justify-end border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:-mx-6 sm:-mb-6 sm:px-6 md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
    >
      <Button type="submit" size="lg" disabled={isPending || disabled} className="w-full md:w-auto md:min-w-40">
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            {savingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}

const LEAVE_MESSAGE = "You have unsaved changes on this form. Leave without saving?";

function useUnsavedChangesGuard(anchor: React.RefObject<HTMLElement | null>, startDirty: boolean) {
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;

    let dirty = startDirty;
    const markDirty = () => {
      dirty = true;
    };
    const markClean = () => {
      dirty = false;
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    // In-app links are client-side navigations that never fire
    // beforeunload, so catch taps on them directly.
    const onDocumentClick = (e: MouseEvent) => {
      if (!dirty || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || form.contains(link)) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        dirty = false;
      }
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", markClean);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", markClean);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [anchor, startDirty]);
}

/** The error message at the top of a form after a failed save. Scrolls
 * itself into view, since on a phone the Save button is usually far
 * below it and the message would otherwise go unseen. */
export function FormError({ message }: { message: string | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message]);

  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{message}</p>
        <p className="mt-0.5 text-destructive/80">Nothing you typed has been lost — fix the issue and tap save again.</p>
      </div>
    </div>
  );
}
