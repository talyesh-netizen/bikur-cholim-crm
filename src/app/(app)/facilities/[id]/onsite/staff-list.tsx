"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone, Plus, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntryCard } from "./entry-card";
import { AddPerson } from "./add-person";

export type OnsiteStaff = { contactId: string; name: string; role: string | null; phone: string | null; primary: boolean };

/** On-site Staff tab (decided Oct 9, 2026): the facility's staff
 * contacts, found by name or role; tap Talked to record a conversation
 * with them right here, or add someone (checked against who's already
 * on file) and record it straight away -- never leaving on-site mode. */
export function StaffList({ facilityId, staff }: { facilityId: string; staff: OnsiteStaff[] }) {
  const [search, setSearch] = useState("");
  const [talkingTo, setTalkingTo] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      staff
        .filter((s) => `${s.name} ${s.role ?? ""}`.toLowerCase().includes(query))
        .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name)),
    [staff, query]
  );
  const logHref = (contactId?: string) =>
    `/interactions/new?facility=${facilityId}&type=facility_staff_communication&from=onsite${contactId ? `&contact=${contactId}` : ""}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          Staff
          <span className="text-sm font-normal text-muted-foreground">{staff.length} on file</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {staff.length > 4 ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search staff by name or role" placeholder="Search name or role" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {query ? "No staff member by that name or role." : "No staff contacts on file here yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {filtered.map((s) => (
              <li key={s.contactId} className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-2">
                <Link href={`/contacts/${s.contactId}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-medium leading-snug">
                    {s.name}
                    {s.primary ? <Star aria-label="Main contact" className="size-3.5 fill-current text-[var(--tone-attention-fg)]" /> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.role || "Role not recorded"}</span>
                </Link>
                {s.phone ? (
                  <Button variant="ghost" size="icon" className="size-11 shrink-0" asChild>
                    <a href={`tel:${s.phone}`} aria-label={`Call ${s.name}`}><Phone /></a>
                  </Button>
                ) : null}
                <Button className="h-11 shrink-0 px-4" onClick={() => setTalkingTo({ id: s.contactId, name: s.name })} disabled={talkingTo?.id === s.contactId}>
                  <MessageCircle /> Talked
                </Button>
                </div>
                {talkingTo?.id === s.contactId ? (
                  <EntryCard
                    facilityId={facilityId}
                    kind="staff"
                    personId={s.contactId}
                    contactId={s.contactId}
                    title={`Talked with ${s.name}${s.role ? `, ${s.role}` : ""}`}
                    onDone={() => setTalkingTo(null)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {/* Just added, so not in the list yet: their conversation here. */}
        {talkingTo && !staff.some((s) => s.contactId === talkingTo.id) ? (
          <EntryCard
            facilityId={facilityId}
            kind="staff"
            personId={talkingTo.id}
            contactId={talkingTo.id}
            title={`Talked with ${talkingTo.name}`}
            onDone={() => setTalkingTo(null)}
          />
        ) : null}
        {adding ? (
          <AddPerson
            kind="staff"
            facilityId={facilityId}
            onCancel={() => setAdding(false)}
            onAdded={(person) => {
              setAdding(false);
              setSearch("");
              setTalkingTo(person);
            }}
          />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {adding ? null : (
            <Button variant="outline" className="h-11 border-dashed" onClick={() => setAdding(true)}>
              <Plus /> Add a staff member
            </Button>
          )}
          <Button variant="ghost" className="h-11" asChild>
            <Link href={logHref()}><MessageCircle /> Talked with someone not listed</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
