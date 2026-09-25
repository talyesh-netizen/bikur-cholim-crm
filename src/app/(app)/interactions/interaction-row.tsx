import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { formatDateTime } from "@/lib/format-date";
import { ClusterBadge } from "@/components/cluster-badge";
import { Pencil } from "lucide-react";

/** One row in the global interactions log — unlike the embedded
 * InteractionList (which already has a resident/facility as context), this
 * shows every linked party as its own link since there's no single owner.
 *
 * contact_id is a general-purpose "who this was with" field that isn't
 * meaningful for a volunteer_visit (some historical rows even had it
 * pointing at the resident's family contact, not the volunteer) -- for
 * that type, the tagged interaction_volunteers are the real answer to
 * "who volunteered," so they're shown instead of contact_id. */
export function InteractionRow({ interaction }: { interaction: InteractionWithNames }) {
  const isVolunteerVisit = interaction.interaction_type === "volunteer_visit";

  const parties = [
    interaction.resident_id && interaction.resident_name
      ? { href: `/residents/${interaction.resident_id}`, label: interaction.resident_name }
      : null,
    !isVolunteerVisit && interaction.contact_id && interaction.contact_name
      ? { href: `/contacts/${interaction.contact_id}`, label: interaction.contact_name }
      : null,
  ].filter((p): p is { href: string; label: string } => p !== null);

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:border-primary/50">
      <Link href={`/interactions/${interaction.id}`} className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{labelFor(INTERACTION_TYPES, interaction.interaction_type)}</Badge>
            {interaction.unmet_need ? <Badge variant="warning">Couldn&apos;t fully meet</Badge> : null}
            {interaction.funder_story ? <Badge variant="outline">Funder story</Badge> : null}
          </div>
          <span className="text-xs text-muted-foreground">{formatDateTime(interaction.occurred_at)}</span>
        </div>

        {interaction.facility_id && interaction.facility_name ? (
          <ClusterBadge clusterId={interaction.facility_cluster_id} name={interaction.facility_name} />
        ) : null}

        {interaction.notes ? (
          <p className="whitespace-pre-wrap text-muted-foreground">{interaction.notes}</p>
        ) : null}

        {interaction.staff_member_name ? (
          <p className="text-xs text-muted-foreground">Logged by {interaction.staff_member_name}</p>
        ) : null}
      </Link>

      {isVolunteerVisit ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Volunteer{interaction.volunteers.length === 1 ? "" : "s"}: </span>
          {interaction.volunteers.length > 0 ? (
            interaction.volunteers.map((v, i) => (
              <span key={v.id}>
                <Link href={`/contacts/${v.id}`} className="font-medium hover:underline">
                  {v.name}
                </Link>
                {i < interaction.volunteers.length - 1 ? ", " : ""}
              </span>
            ))
          ) : (
            <span className="font-medium text-warning">Not tagged yet</span>
          )}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {parties.length > 0 ? (
          <p className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm">
            {parties.map((p, i) => (
              <span key={p.href} className="flex items-center gap-1">
                <Link
                  href={p.href}
                  className={isVolunteerVisit ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}
                >
                  {p.label}
                </Link>
                {i < parties.length - 1 ? <span className="text-muted-foreground">·</span> : null}
              </span>
            ))}
          </p>
        ) : (
          <span />
        )}
        <Link
          href={`/interactions/${interaction.id}/edit`}
          title="Edit this interaction"
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </Link>
      </div>
    </li>
  );
}
