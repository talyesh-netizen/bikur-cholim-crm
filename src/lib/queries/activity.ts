import { createClient } from "@/lib/supabase/server";
import { listActiveStaff } from "@/lib/queries/profiles";
import { listContactOptions } from "@/lib/queries/contacts";
import { listOrganizations } from "@/lib/queries/organizations";
import { labelFor, ORGANIZATION_TYPES } from "@/lib/domain/organization";

/** A group project another activity can be "part of": the first activity
 * of e.g. Chavivah High School's Oct 9 visits, which holds the group's
 * volunteer count. */
export type GroupProjectOption = {
  id: string;
  occurred_at: string;
  partner_organization_id: string;
  partner_name: string;
  participants: number;
  facility_name: string | null;
};

/** Everything the log form needs beyond the basics, loaded together. */
export type ActivityFormOptions = {
  currentUserId: string | null;
  staff: { id: string; name: string }[];
  /** Facility staff, for "Staff you worked with or spoke to". */
  facilityStaff: { id: string; name: string; detail?: string | null }[];
  /** Anyone, for "Others who were there". */
  anyone: { id: string; name: string; detail?: string | null }[];
  partners: { id: string; name: string; detail?: string | null }[];
  groupProjects: GroupProjectOption[];
};

const GROUP_PROJECT_LOOKBACK_DAYS = 120;

export async function getActivityFormOptions(): Promise<ActivityFormOptions> {
  const supabase = await createClient();
  const since = new Date(Date.now() - GROUP_PROJECT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [
    {
      data: { user },
    },
    staff,
    facilityStaff,
    anyone,
    partners,
    projects,
  ] = await Promise.all([
    supabase.auth.getUser(),
    listActiveStaff(),
    listContactOptions("facility_staff"),
    listContactOptions(),
    listOrganizations({ world: "partners" }),
    supabase
      .from("interactions")
      .select("id, occurred_at, partner_organization_id, participants, organizations(name), facilities(name)")
      .not("partner_organization_id", "is", null)
      .gt("participants", 0)
      .is("part_of_id", null)
      .is("counted_in_id", null)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false }),
  ]);

  return {
    currentUserId: user?.id ?? null,
    staff: staff.map((s) => ({ id: s.id, name: s.full_name })),
    facilityStaff,
    anyone,
    partners: partners.map((o) => ({ id: o.id, name: o.name, detail: labelFor(ORGANIZATION_TYPES, o.organization_type) })),
    groupProjects: (
      (projects.data ?? []) as unknown as {
        id: string;
        occurred_at: string;
        partner_organization_id: string;
        participants: number;
        organizations: { name: string } | null;
        facilities: { name: string } | null;
      }[]
    ).map((p) => ({
      id: p.id,
      occurred_at: p.occurred_at,
      partner_organization_id: p.partner_organization_id,
      partner_name: p.organizations?.name ?? "the group",
      participants: p.participants,
      facility_name: p.facilities?.name ?? null,
    })),
  };
}

type Linked = { id: string; name: string };

/** Who and what is linked to one activity, for its page and edit form. */
export type ActivityExtras = {
  partner: Linked | null;
  enteredBy: Linked | null;
  team: Linked[];
  engaged: Linked[];
  present: Linked[];
  /** The project's first activity, when this one is "Part of" it. */
  partOf: { id: string; occurred_at: string; facility_name: string | null; participants: number | null } | null;
  /** Activities that are "Part of" this one (when it holds the count). */
  projectMembers: { id: string; occurred_at: string; facility_name: string | null }[];
  /** The entry this one was reviewed as a copy of. */
  countedIn: { id: string; occurred_at: string } | null;
};

export async function getActivityExtras(id: string): Promise<ActivityExtras> {
  const supabase = await createClient();
  const [{ data: row }, { data: contacts }, { data: team }, { data: members }] = await Promise.all([
    supabase
      .from("interactions")
      .select(
        "part_of_id, counted_in_id, organizations(id, name), entered:profiles!interactions_entered_by_fkey(id, full_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("interaction_contacts").select("engaged, contacts(id, name)").eq("interaction_id", id),
    supabase.from("interaction_team_members").select("profiles(id, full_name)").eq("interaction_id", id),
    supabase
      .from("interactions")
      .select("id, occurred_at, facilities(name)")
      .eq("part_of_id", id)
      .order("occurred_at"),
  ]);

  const r = row as unknown as {
    part_of_id: string | null;
    counted_in_id: string | null;
    organizations: { id: string; name: string } | null;
    entered: { id: string; full_name: string } | null;
  } | null;

  const lookup = async (otherId: string | null | undefined) => {
    if (!otherId) return null;
    const { data } = await supabase
      .from("interactions")
      .select("id, occurred_at, participants, facilities(name)")
      .eq("id", otherId)
      .maybeSingle();
    return data as unknown as { id: string; occurred_at: string; participants: number | null; facilities: { name: string } | null } | null;
  };
  const [partOf, countedIn] = await Promise.all([lookup(r?.part_of_id), lookup(r?.counted_in_id)]);

  const links = (contacts ?? []) as unknown as { engaged: boolean; contacts: Linked | null }[];
  return {
    partner: r?.organizations ?? null,
    enteredBy: r?.entered ? { id: r.entered.id, name: r.entered.full_name } : null,
    team: ((team ?? []) as unknown as { profiles: { id: string; full_name: string } | null }[])
      .flatMap((t) => (t.profiles ? [{ id: t.profiles.id, name: t.profiles.full_name }] : [])),
    engaged: links.filter((l) => l.engaged && l.contacts).map((l) => l.contacts!),
    present: links.filter((l) => !l.engaged && l.contacts).map((l) => l.contacts!),
    partOf: partOf
      ? { id: partOf.id, occurred_at: partOf.occurred_at, facility_name: partOf.facilities?.name ?? null, participants: partOf.participants }
      : null,
    projectMembers: ((members ?? []) as unknown as { id: string; occurred_at: string; facilities: { name: string } | null }[]).map((m) => ({
      id: m.id,
      occurred_at: m.occurred_at,
      facility_name: m.facilities?.name ?? null,
    })),
    countedIn: countedIn ? { id: countedIn.id, occurred_at: countedIn.occurred_at } : null,
  };
}

/** Staff contacts marked "worked with or spoke to" on these entries
 * (beyond each entry's own contact) -- for "Talked today" on site. */
export async function listEngagedContacts(interactionIds: string[]): Promise<{ interaction_id: string; contact_id: string }[]> {
  if (interactionIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interaction_contacts")
    .select("interaction_id, contact_id")
    .in("interaction_id", interactionIds)
    .eq("engaged", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as { interaction_id: string; contact_id: string }[];
}
