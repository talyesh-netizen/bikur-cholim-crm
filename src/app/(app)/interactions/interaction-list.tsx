import Link from "next/link";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { ListPlus, Pencil } from "lucide-react";

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
        const otherParty =
          variant === "resident" ? interaction.facility_name : interaction.resident_name;
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
                  {new Date(interaction.occurred_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
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
