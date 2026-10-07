import Link from "next/link";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { ClusterBadge } from "@/components/cluster-badge";
import { ListPlus, Pencil } from "lucide-react";
import { formatDateTimeWithTime } from "@/lib/format-date";
import { withContactLabel } from "@/lib/domain/contact";

/** Recent-interactions list shown on both resident and facility pages —
 * the "other side" of the record (facility name on a resident page,
 * resident name on a facility page) is shown as context, when present. */
export function InteractionList({
  interactions,
  variant,
  emptyMessage = "No interactions logged yet.",
}: {
  interactions: InteractionWithNames[];
  variant: "resident" | "facility";
  emptyMessage?: string;
}) {
  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {interactions.map((interaction) => {
        const isVolunteerVisit = interaction.interaction_type === "volunteer_visit";
        const isFamily = interaction.interaction_type === "family_communication";
        const residentPart =
          variant === "facility" && interaction.resident_name
            ? isFamily
              ? `about ${interaction.resident_name}`
              : interaction.resident_name
            : null;
        // Who it was with ("With Bob Gottfried (spouse)"), so a family
        // conversation doesn't read as support for the resident.
        const withPart = isVolunteerVisit ? null : withContactLabel(interaction.contact_name, interaction.contact_relationship);
        const otherParty = [withPart, residentPart].filter(Boolean).join(" · ") || null;
        return (
          <li key={interaction.id} className="relative flex flex-col gap-0.5 text-sm">
            <Link
              href={`/interactions/${interaction.id}`}
              className="-mx-1.5 flex flex-col gap-0.5 rounded-md px-1.5 py-0.5 pr-14 hover:bg-accent/50"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium">
                  {labelFor(INTERACTION_TYPES, interaction.interaction_type)}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTimeWithTime(interaction.occurred_at)}
                </span>
              </div>
              {variant === "resident" && interaction.facility_name ? (
                <ClusterBadge clusterId={interaction.facility_cluster_id} name={interaction.facility_name} />
              ) : null}
              {isVolunteerVisit ? (
                <p className="text-xs text-muted-foreground">
                  Volunteer{interaction.volunteers.length === 1 ? "" : "s"}:{" "}
                  {interaction.volunteers.length > 0
                    ? interaction.volunteers.map((v) => v.name).join(", ")
                    : "not tagged yet"}
                </p>
              ) : null}
              {otherParty || interaction.staff_member_name ? (
                <p className="text-xs text-muted-foreground">
                  {[otherParty, interaction.staff_member_name && `logged by ${interaction.staff_member_name}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {interaction.notes ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{interaction.notes}</p>
              ) : null}
            </Link>
            <span className="absolute right-1.5 top-0.5 flex items-center gap-2">
              <Link
                href={`/tasks/new?interaction=${interaction.id}`}
                title="Add a follow-up task for this interaction"
                className="text-muted-foreground hover:text-foreground"
              >
                <ListPlus className="size-4" />
              </Link>
              <Link
                href={`/interactions/${interaction.id}/edit`}
                title="Edit this interaction"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </Link>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
