import Link from "next/link";
import type { ChangeLogEntry } from "@/lib/queries/change-log";
import { formatDateTimeWithTime } from "@/lib/format-date";
import { RESIDENT_STATUSES, labelFor } from "@/lib/domain/resident";

const TABLE_LABELS: Record<string, { label: string; href?: (id: string) => string }> = {
  residents: { label: "Resident", href: (id) => `/residents/${id}` },
  facilities: { label: "Facility", href: (id) => `/facilities/${id}` },
  contacts: { label: "Contact", href: (id) => `/contacts/${id}` },
  organizations: { label: "Shul / partner", href: (id) => `/organizations/${id}` },
  interactions: { label: "Interaction", href: (id) => `/interactions/${id}` },
  tasks: { label: "Task", href: (id) => `/tasks/${id}` },
  resident_contacts: { label: "Resident's family link" },
  facility_contacts: { label: "Facility contact link" },
  organization_contacts: { label: "Partner contact link" },
};

// Linked-record ids aren't meaningful to read, so they just say "changed".
const HIDDEN_VALUE_FIELDS = (field: string) => field === "id" || field.endsWith("_id") || field.endsWith("_by");

function fieldLabel(field: string) {
  const text = field.replace(/_id$/, "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function show(value: unknown, table: string, field: string) {
  if (value === null || value === undefined || value === "") return "(blank)";
  if (table === "residents" && field === "status" && typeof value === "string") return labelFor(RESIDENT_STATUSES, value);
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function ChangeLines({ entry }: { entry: ChangeLogEntry }) {
  if (entry.action === "delete") {
    return <p className="text-sm">Removed. Everything it said is saved here for an administrator.</p>;
  }
  const fields = Object.entries(entry.changes as Record<string, { old: unknown; new: unknown }>);
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {fields.map(([field, change]) => (
        <li key={field} className="break-words">
          <span className="font-medium">{fieldLabel(field)}:</span>{" "}
          {HIDDEN_VALUE_FIELDS(field) ? (
            <span className="text-muted-foreground">changed</span>
          ) : (
            <>
              <span className="text-muted-foreground line-through">{show(change?.old, entry.table_name, field)}</span>
              {" → "}
              <span>{show(change?.new, entry.table_name, field)}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ChangeHistoryList({ entries, showRecord = false }: { entries: ChangeLogEntry[]; showRecord?: boolean }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No edits recorded yet. (Recording started October 2, 2026.)</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {entries.map((entry) => {
        const table = TABLE_LABELS[entry.table_name] ?? { label: entry.table_name };
        return (
          <li key={entry.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <p className="text-xs text-muted-foreground">
              {formatDateTimeWithTime(entry.changed_at)} · <span className="font-medium text-foreground">{entry.changed_by_name}</span>
              {showRecord ? (
                <>
                  {" · "}
                  {table.href && entry.action !== "delete" ? (
                    <Link href={table.href(entry.record_id)} className="underline hover:text-primary">
                      {table.label}
                    </Link>
                  ) : (
                    table.label
                  )}
                </>
              ) : null}
            </p>
            <ChangeLines entry={entry} />
          </li>
        );
      })}
    </ul>
  );
}
