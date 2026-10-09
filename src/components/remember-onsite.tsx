"use client";

import { useEffect } from "react";

export const LAST_ONSITE_KEY = "last-onsite-facility";

/** Notes which facility's visit page was open last, so Today can offer
 * "Continue at …" after the phone was locked or the app was closed. */
export function RememberOnsite({ facilityId, facilityName }: { facilityId: string; facilityName: string }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_ONSITE_KEY, JSON.stringify({ id: facilityId, name: facilityName, at: Date.now() }));
    } catch {
      // Blocked storage: nothing to remember.
    }
  }, [facilityId, facilityName]);
  return null;
}
