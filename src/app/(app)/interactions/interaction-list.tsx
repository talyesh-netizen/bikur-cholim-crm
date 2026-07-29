import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";

/** Recent-interactions list shown on both resident and facility pages —
 * the "other side" of the record (facility name on a resident page,
 * resident name on a facility page) is shown as context, when present. */
export function InteractionList({
  interactions,
  variant,
}: {
  interactions: InteractionWithNames[];
  variant: "resident" | "facility";
}) {
  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No interactions logged yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {interactions.map((interaction) => {
        const otherParty =
          variant === "resident" ? interaction.facility_name : interaction.resident_name;
        return (
          <li key={interaction.id} className="flex flex-col gap-0.5 text-sm">
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
          </li>
        );
      })}
    </ol>
  );
}
