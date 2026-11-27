"use client";

import { useEffect } from "react";

/**
 * Coming back to a list after a save (Nov 27, 2026): scrolls to the place
 * the person left from, named by `?at=` (or a #hash), then takes it out of
 * the address. Needed because a save lands with the form's scroll position,
 * not the list's.
 */
export function ScrollToPlace() {
  useEffect(() => {
    let url: URL;
    try {
      url = new URL(window.location.href);
    } catch {
      return;
    }
    const at = url.searchParams.get("at") ?? (url.hash ? decodeURIComponent(url.hash.slice(1)) : "");
    if (!at || !/^[\w-]+$/.test(at)) return;
    const go = () => document.getElementById(at)?.scrollIntoView({ block: "start" });
    go();
    // Once more after the page settles (fonts, the saved message).
    const timer = window.setTimeout(go, 150);
    if (url.searchParams.has("at")) {
      url.searchParams.delete("at");
      window.history.replaceState(window.history.state, "", url);
    }
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
