/**
 * On-site entries not yet saved, kept on this phone (localStorage) until
 * the CRM confirms the save -- so a dropped connection, a tap on the
 * wrong link or a closed tab never loses what was typed or dictated.
 * Each draft keeps its submission id, so retrying it can't save twice.
 */

export type OnsiteDraft = { notes: string; submissionId: string; updatedAt: number };

const PREFIX = "onsite-entry:";
// A draft older than this is from another day's visit; it's dropped.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function draftKey(facilityId: string, kind: string, personId: string) {
  return `${PREFIX}${facilityId}:${kind}:${personId}`;
}

export function newSubmissionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Older browsers: a random v4-shaped id.
    return "xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}

export function readDraft(key: string): OnsiteDraft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(key) ?? "null") as OnsiteDraft | null;
    if (!draft || Date.now() - draft.updatedAt > MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: OnsiteDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the note still saves normally.
  }
}

export function removeDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing kept.
  }
}

/** The people at this facility with a note still waiting to be saved. */
export function draftsAt(facilityId: string): Set<string> {
  const people = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(`${PREFIX}${facilityId}:`)) continue;
      const draft = readDraft(key);
      if (draft?.notes.trim()) people.add(key.split(":").pop() as string);
    }
  } catch {
    // None readable.
  }
  return people;
}
