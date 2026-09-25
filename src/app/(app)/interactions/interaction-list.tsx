import Link from "next/link";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { ClusterBadge } from "@/components/cluster-badge";
import { EmptyState } from "@/components/empty-state";
import { formatRelative } from "@/lib/format-date";
import { History, ListPlus, Pencil } from "lucide-react";

/** Recent-interactions list shown on both resident and facility pages —
 * the "other side" of the record (facility name on a resident page,
 * resident name on a facility page) is shown as context, when present.
 * Reads as a simple timeline: what happened, when, who, and the notes. */
export function InteractionList({
  interactions,
  variant,
  emptyMessage,
  emptyAction,
}: {
  interactions: InteractionWithNames[];
  variant: "resident" | "facility";
  emptyMessage?: string;
  emptyAction?: { href: string; label: string };
}) {
  if (interactions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No interactions yet"
        description={
          emptyMessage ??
          (variant === "resident"
            ? "Visits, calls, and family updates for this resident will show up here once they're logged."
            : "Visits, programs, and staff conversations at this facility will show up here once they're logged.")
        }
        action={emptyAction}
      />
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {interactions.map((interaction) => {
        const isVolunteerVisit = interaction.interaction_type === "volunteer_visit";
        const otherParty = variant === "facility" ? interaction.resident_name : null;
        const when = new Date(interaction.occurred_at);
        return (
          <li key={interaction.id} className="flex gap-2 py-3 first:pt-0 last:pb-0">
            <Link
              href={`/interactions/${interaction.id}`}
              className="-mx-2 flex min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-1 hover:bg-accent/50"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-medium leading-snug">
                  {labelFor(INTERACTION_TYPES, interaction.interaction_type)}
                  {otherParty ? <span className="font-normal text-muted-foreground"> · {otherParty}</span> : null}
                </span>
                <time
                  dateTime={interaction.occurred_at}
                  className="whitespace-nowrap text-sm text-muted-foreground"
                  title={when.toLocaleString("en-US")}
                >
                  {formatRelative(interaction.occurred_at)}
                </time>
              </div>
              {variant === "resident" && interaction.facility_name ? (
                <ClusterBadge
                  clusterId={interaction.facility_cluster_id}
                  name={interaction.facility_name}
                  className="self-start"
                />
              ) : null}
              {isVolunteerVisit ? (
                <p className="text-sm text-muted-foreground">
                  Volunteer{interaction.volunteers.length === 1 ? "" : "s"}:{" "}
                  {interaction.volunteers.length > 0 ? (
                    interaction.volunteers.map((v) => v.name).join(", ")
                  ) : (
                    <span className="font-medium text-tone-attention-fg">No volunteer tagged yet</span>
                  )}
                </p>
              ) : null}
              {interaction.notes ? (
                <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">{interaction.notes}</p>
              ) : null}
              {interaction.staff_member_name ? (
                <p className="text-sm text-muted-foreground">Logged by {interaction.staff_member_name}</p>
              ) : null}
            </Link>
            <span className="flex shrink-0 flex-col gap-1">
              <Link
                href={`/tasks/new?interaction=${interaction.id}`}
                title="Add a follow-up task for this interaction"
                aria-label="Add a follow-up task for this interaction"
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ListPlus className="size-4" />
              </Link>
              <Link
                href={`/interactions/${interaction.id}/edit`}
                title="Edit this interaction"
                aria-label="Edit this interaction"
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
