import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { formatDateTime } from "@/lib/format-date";
import { Pencil } from "lucide-react";

/** One row in the global interactions log — unlike the embedded
 * InteractionList (which already has a resident/facility as context), this
 * shows every linked party as its own link since there's no single owner. */
export function InteractionRow({ interaction }: { interaction: InteractionWithNames }) {
  const parties = [
    interaction.facility_id && interaction.facility_name
      ? { href: `/facilities/${interaction.facility_id}`, label: interaction.facility_name }
      : null,
    interaction.resident_id && interaction.resident_name
      ? { href: `/residents/${interaction.resident_id}`, label: interaction.resident_name }
      : null,
    interaction.contact_id && interaction.contact_name
      ? { href: `/contacts/${interaction.contact_id}`, label: interaction.contact_name }
      : null,
  ].filter((p): p is { href: string; label: string } => p !== null);

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:border-primary/50">
      <Link href={`/interactions/${interaction.id}`} className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Badge variant="secondary">{labelFor(INTERACTION_TYPES, interaction.interaction_type)}</Badge>
          <span className="text-xs text-muted-foreground">{formatDateTime(interaction.occurred_at)}</span>
        </div>

        {interaction.notes ? (
          <p className="whitespace-pre-wrap text-muted-foreground">{interaction.notes}</p>
        ) : null}

        {interaction.staff_member_name ? (
          <p className="text-xs text-muted-foreground">Logged by {interaction.staff_member_name}</p>
        ) : null}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {parties.length > 0 ? (
          <p className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm">
            {parties.map((p, i) => (
              <span key={p.href} className="flex items-center gap-1">
                <Link href={p.href} className="font-medium hover:underline">
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
