import { getLocalToday } from "@/lib/format-date";

/**
 * The on-site visit in progress on this phone (decided Oct 9, 2026,
 * after iPhone testing): a visit starts when a facility's on-site page
 * is opened, belongs to that one Cleveland day, and ends with "Finish
 * visit → Done". Only a visit that is genuinely still open -- started
 * today, not finished -- is offered as "Resume visit". Yesterday's visit
 * is never presented as current, and no facility is ever assumed from
 * a past visit. Unsaved notes are kept separately (see onsite-drafts and
 * Quick Log's drafts), so ending or dropping a session never loses them.
 *
 * Kept in localStorage: it describes this phone, not the CRM's data.
 */

const KEY = "onsite-visit-session";
// The old "last facility opened" memory this replaces -- removed on sight.
const OLD_KEY = "last-onsite-facility";

export type VisitSession = { facilityId: string; facilityName: string; day: string; startedAt: number };

function read(): VisitSession | null {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "null") as VisitSession | null;
  } catch {
    return null;
  }
}

/** Opening a facility's on-site page starts (or continues) its visit. */
export function startVisitSession(facilityId: string, facilityName: string) {
  try {
    window.localStorage.removeItem(OLD_KEY);
    const today = getLocalToday();
    const current = read();
    const continuing = current && current.facilityId === facilityId && current.day === today;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ facilityId, facilityName, day: today, startedAt: continuing ? current.startedAt : Date.now() })
    );
  } catch {
    // Blocked storage: nothing to resume later, nothing assumed either.
  }
}

/** The visit still open today, if any. One from an earlier day is
 * dropped here -- its unsaved notes stay where they are. */
export function readActiveVisitSession(): VisitSession | null {
  try {
    window.localStorage.removeItem(OLD_KEY);
    const session = read();
    if (!session) return null;
    if (session.day !== getLocalToday()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Finish visit → Done, or "End this visit": nothing is open any more. */
export function endVisitSession() {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(OLD_KEY);
  } catch {
    // Nothing kept.
  }
}

/** Facilities with notes typed on site but not saved yet -- on-site
 * Visit/Talked notes and the on-site notes box -- however old the visit,
 * with when the oldest was started (null when it was kept before start
 * times were recorded). */
export function facilitiesWithUnsavedNotes(): Map<string, { count: number; since: number | null }> {
  const found = new Map<string, { count: number; since: number | null }>();
  const add = (facilityId: string, started: number | null) => {
    const prev = found.get(facilityId);
    const since = prev ? (prev.since === null || started === null ? null : Math.min(prev.since, started)) : started;
    found.set(facilityId, { count: (prev?.count ?? 0) + 1, since });
  };
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? "";
      const raw = window.localStorage.getItem(key) ?? "";
      if (key.startsWith("onsite-entry:")) {
        const draft = JSON.parse(raw || "null") as { notes?: string; startedAt?: number; updatedAt?: number } | null;
        if (draft?.notes?.trim()) add(key.split(":")[1], draft.startedAt ?? draft.updatedAt ?? null);
      } else if (key.startsWith("quick-log-draft:") && raw.trim()) {
        let started: number | null = null;
        let text = raw;
        try {
          const parsed = JSON.parse(raw) as { note?: string; startedAt?: number | null };
          if (parsed && typeof parsed.note === "string") {
            text = parsed.note;
            started = typeof parsed.startedAt === "number" ? parsed.startedAt : null;
          }
        } catch {
          // An older plain-text note.
        }
        if (text.trim()) add(key.split(":")[1], started);
      }
    }
  } catch {
    // None readable.
  }
  return found;
}
