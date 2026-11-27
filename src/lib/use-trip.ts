"use client";

import { useEffect, useState } from "react";
import { currentTripId } from "@/lib/visit-session";

/**
 * "&trip=<id>" for a form opened from On-site (Nov 27, 2026), so Food
 * today or a staff conversation saved there belongs to this trip, not the
 * day's first one. Read on this phone after the page loads; empty until
 * then, or when no On-site visit is open here.
 */
export function useTripParam(facilityId: string): string {
  const [param, setParam] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => {
      const trip = currentTripId(facilityId);
      setParam(trip ? `&trip=${trip}` : "");
    }, 0);
    return () => window.clearTimeout(t);
  }, [facilityId]);
  return param;
}
