"use client";

import { useEffect } from "react";
import { startVisitSession } from "@/lib/visit-session";

/** Opening a facility's on-site page starts (or continues) today's
 * visit there, so Today can offer "Resume visit" until it's finished --
 * see lib/visit-session.ts. */
export function RememberOnsite({ facilityId, facilityName }: { facilityId: string; facilityName: string }) {
  useEffect(() => {
    startVisitSession(facilityId, facilityName);
  }, [facilityId, facilityName]);
  return null;
}
