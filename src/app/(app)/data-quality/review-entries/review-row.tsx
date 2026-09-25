"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INTERACTION_TYPES,
  OCCASIONS,
  PROGRAM_PARTNERS,
  SERVICE_FIELDS_BY_TYPE,
  labelFor,
  type InteractionType,
} from "@/lib/domain/interaction";
import { saveInteractionReview, type ReviewFormState } from "@/lib/actions/interactions";
import type { UnreviewedEntry } from "@/lib/queries/data-quality";
import { formatDateTime } from "@/lib/format-date";
import { CheckCircle2, Pencil } from "lucide-react";

/** One older entry on the "Review past entries" screen: read the notes,
 * confirm or change the type (plus the few numbers some types ask
 * about), and save -- without leaving the list. */
export function ReviewRow({ entry }: { entry: UnreviewedEntry }) {
  const [state, formAction, isPending] = useActionState<ReviewFormState, FormData>(
    saveInteractionReview.bind(null, entry.id),
    { error: null }
  );
  const [type, setType] = useState<string>(entry.interaction_type);
  const fields = SERVICE_FIELDS_BY_TYPE[type as InteractionType] ?? [];
  const changed = type !== entry.interaction_type;

  if (state.saved) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-border bg-success/5 px-4 py-2.5 text-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          Saved as <span className="font-medium">{labelFor(INTERACTION_TYPES, type)}</span>
          {entry.resident_name ?? entry.facility_name ? ` — ${entry.resident_name ?? entry.facility_name}` : ""}
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {[entry.resident_name, entry.facility_name].filter(Boolean).join(" · ") || "No resident or facility"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.occurred_at)}
            {entry.staff_member_name ? ` · logged by ${entry.staff_member_name}` : ""}
          </p>
        </div>
        <Link
          href={`/interactions/${entry.id}/edit`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
          Full edit
        </Link>
      </div>

      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2">
        {entry.notes || <span className="text-muted-foreground">No notes</span>}
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="interaction_type" value={type} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Type</span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {fields.includes("program_partner") ? (
            <MiniSelect name="program_partner" label="School or shul?" options={PROGRAM_PARTNERS} defaultValue={entry.program_partner ?? ""} />
          ) : null}
          {fields.includes("occasion") ? (
            <MiniSelect name="occasion" label="Occasion" options={OCCASIONS} defaultValue={entry.occasion ?? ""} />
          ) : null}
          {fields.includes("quantity") ? (
            <MiniNumber name="quantity" label="How many items?" defaultValue={entry.quantity} />
          ) : null}
          {fields.includes("participants") ? (
            <MiniNumber name="participants" label="Students / members" defaultValue={entry.participants} />
          ) : null}
          {fields.includes("people_reached") ? (
            <MiniNumber name="people_reached" label="Residents reached (about)" defaultValue={entry.people_reached} />
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending} variant={changed ? "default" : "outline"}>
            {isPending ? "Saving…" : changed ? "Save change" : "Looks right"}
          </Button>
        </div>
      </form>
    </li>
  );
}

function MiniSelect({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MiniNumber({ name, label, defaultValue }: { name: string; label: string; defaultValue: number | null }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input name={name} type="number" inputMode="numeric" min={0} step={1} defaultValue={defaultValue ?? ""} />
    </label>
  );
}
