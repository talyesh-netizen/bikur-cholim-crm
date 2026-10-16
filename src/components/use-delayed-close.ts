import { useCallback, useEffect, useRef } from "react";
import type React from "react";

/**
 * Closes a picker's list a moment after its box loses focus (so a tap on
 * a result lands first) -- and cancels that if the box gets focus back or
 * is typed in. Phones (iPhone Safari especially) can take the keyboard
 * away and give it straight back while someone types; without the
 * cancel, the leftover close emptied the box after the first letter and
 * the second letter started a new search ("abbi" instead of "Rabbi").
 */
export function useDelayedClose(
  setOpen: (open: boolean) => void,
  /** The box itself: never closed while it has the keyboard. */
  inputRef?: React.RefObject<HTMLInputElement | null>,
  ms = 150
) {
  const timer = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (inputRef?.current && document.activeElement === inputRef.current) return;
      setOpen(false);
    }, ms);
  }, [cancelClose, setOpen, inputRef, ms]);
  useEffect(() => cancelClose, [cancelClose]);
  return { scheduleClose, cancelClose };
}
