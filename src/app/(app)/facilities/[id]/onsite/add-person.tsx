"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capitalizeAsYouType } from "@/lib/format-text";
import { OFFERED_RELATIONSHIPS, RESIDENT_CONTACT_RELATIONSHIPS, labelFor } from "@/lib/domain/contact";
import {
  addOnsiteFamily,
  addOnsiteResident,
  addOnsiteStaff,
  findPossibleMatches,
  type PossibleMatch,
} from "@/lib/actions/onsite-entries";

type Kind = "resident" | "staff" | "family";
const TITLE: Record<Kind, string> = { resident: "Add a resident here", staff: "Add a staff member here", family: "Add a family member" };

/**
 * Add a resident, staff member or family member without leaving on-site
 * mode. Before anyone new is created, people already on file with that
 * name are shown, so the same person isn't entered twice. Once added
 * (or picked), `onAdded` opens their visit or conversation right away.
 */
export function AddPerson({
  kind,
  facilityId,
  residentId,
  residentName,
  onAdded,
  onExistingResidentHere,
  onCancel,
}: {
  kind: Kind;
  facilityId: string;
  /** For a family member: whose family. */
  residentId?: string;
  residentName?: string;
  onAdded: (person: { id: string; name: string }) => void;
  /** A matching resident who already lives here: just visit them. */
  onExistingResidentHere?: (residentId: string) => void;
  onCancel: () => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [room, setRoom] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<(typeof OFFERED_RELATIONSHIPS)[number]>("son");
  const [matches, setMatches] = useState<PossibleMatch[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);

  const name = kind === "resident" ? `${first} ${last}`.trim() : first.trim();

  // Look for people already on file as the name is typed.
  useEffect(() => {
    const request = ++latest.current;
    if (name.length < 2) {
      const t = window.setTimeout(() => setMatches(null), 0);
      return () => window.clearTimeout(t);
    }
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const found = await findPossibleMatches({ kind, name, facilityId, residentId });
        if (request === latest.current) setMatches(found);
      } catch {
        if (request === latest.current) setMatches([]);
      } finally {
        if (request === latest.current) setChecking(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [kind, name, facilityId, residentId]);

  function add(existingContactId?: string) {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "resident"
          ? await addOnsiteResident({ facilityId, firstName: first, lastName: last, room })
          : kind === "staff"
            ? await addOnsiteStaff({ facilityId, existingContactId, name: first, role, phone })
            : await addOnsiteFamily({ facilityId, residentId: residentId as string, existingContactId, name: first, relationship, phone });
      if (!result.ok) setError(result.error);
      else onAdded({ id: result.id, name: result.name });
    });
  }

  const checked = matches !== null && !checking;

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-primary/40 bg-card p-3">
      <p className="text-sm font-semibold">
        {TITLE[kind]}
        {kind === "family" && residentName ? ` for ${residentName}` : ""}
      </p>

      {kind === "resident" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name"><Input value={first} onChange={(e) => { capitalizeAsYouType(e); setFirst(e.target.value); }} autoFocus className="h-11" /></Field>
          <Field label="Last name"><Input value={last} onChange={(e) => { capitalizeAsYouType(e); setLast(e.target.value); }} className="h-11" /></Field>
          <Field label="Room (optional)"><Input value={room} onChange={(e) => setRoom(e.target.value)} className="h-11" /></Field>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name"><Input value={first} onChange={(e) => { capitalizeAsYouType(e); setFirst(e.target.value); }} autoFocus className="h-11" /></Field>
          {kind === "staff" ? (
            <Field label="Role (optional)"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Activities Director" className="h-11" /></Field>
          ) : (
            <Field label="Relationship">
              <select value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm">
                {OFFERED_RELATIONSHIPS.map((r) => <option key={r} value={r}>{labelFor(RESIDENT_CONTACT_RELATIONSHIPS, r)}</option>)}
              </select>
            </Field>
          )}
          <Field label="Phone (optional)"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" /></Field>
        </div>
      )}

      {checking ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking who&apos;s already on file…</p>
      ) : matches && matches.length > 0 ? (
        <div className="rounded-md border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm">
          <p className="font-medium text-[var(--tone-attention-fg)]">Already on file? Pick them instead of adding again:</p>
          <ul className="mt-2 flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md bg-card p-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">{m.detail}</span>
                </span>
                {kind === "resident" ? (
                  m.here && onExistingResidentHere ? (
                    <Button className="h-11 shrink-0" onClick={() => onExistingResidentHere(m.id)}><UserCheck /> That&apos;s them</Button>
                  ) : (
                    // Living somewhere else: moving them is done on their page.
                    <Button variant="outline" className="h-11 shrink-0" asChild><Link href={`/residents/${m.id}`}>Open</Link></Button>
                  )
                ) : (
                  <Button className="h-11 shrink-0" onClick={() => add(m.id)} disabled={pending}><UserCheck /> That&apos;s them</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm font-medium text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button className="h-12 flex-1" onClick={() => add()} disabled={pending || !checked || name.length < 2}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {matches && matches.length > 0 ? "None of these — add new" : "Add"}
        </Button>
        <Button variant="ghost" className="h-12" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

// A wrapping <label>, so tapping the words focuses the box and screen
// readers name it.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
