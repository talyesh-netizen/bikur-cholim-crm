"use client";

import { FormActions, FormError } from "@/components/form-actions";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { FacilityPicker } from "@/components/facility-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/lib/domain/task";
import type { TaskFormState } from "@/lib/actions/tasks";

type Action = (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;

function taskToFormValues(task?: Task): Record<string, string> {
  if (!task) return { priority: "medium" };
  return {
    title: task.title,
    description: task.description ?? "",
    due_date: task.due_date ?? "",
    priority: task.priority,
    task_category: task.task_category,
    assigned_to: task.assigned_to ?? "",
    resident_id: task.resident_id ?? "",
    facility_id: task.facility_id ?? "",
    interaction_id: task.interaction_id ?? "",
  };
}

export function TaskForm({
  action,
  task,
  staff,
  facilities,
  fixedContext,
  defaultAssigneeId,
  defaultTitle,
  existingTasks = [],
}: {
  action: Action;
  task?: Task;
  staff: { id: string; full_name: string }[];
  facilities: { id: string; name: string }[];
  /** Set when creating a task from a resident/facility/interaction page
   * — that connection is fixed rather than user-editable. */
  fixedContext?: { label: string; residentId?: string; facilityId?: string; interactionId?: string };
  /** New tasks start assigned to whoever is creating them, so a task is
   * never accidentally nobody's (and so gets due-date reminders). */
  defaultAssigneeId?: string;
  /** Typed into the task search before choosing "Add as a new task". */
  defaultTitle?: string;
  /** Tasks already recorded, to point out a likely duplicate while typing. */
  existingTasks?: SimilarTask[];
}) {
  const [state, formAction, isPending] = useActionState<TaskFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? {
    ...taskToFormValues(task),
    ...(!task && defaultTitle ? { title: defaultTitle } : {}),
    ...(!task && defaultAssigneeId ? { assigned_to: defaultAssigneeId } : {}),
    resident_id: fixedContext?.residentId ?? "",
    facility_id: fixedContext?.facilityId ?? "",
    interaction_id: fixedContext?.interactionId ?? "",
  };
  const formKey = JSON.stringify(values);
  const [title, setTitle] = useState(values.title ?? "");
  const similar = useMemo(() => similarTasks(title, existingTasks, fixedContext?.residentId), [title, existingTasks, fixedContext?.residentId]);
  // The extras start folded on a new task; an existing one with any of
  // them filled in (or an error in one) opens them.
  const showMore = !!(fieldErrors.due_date || fieldErrors.assigned_to || fieldErrors.facility_id || (task && (values.due_date || values.facility_id)));

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      {fixedContext ? (
        <div className="flex flex-col gap-1.5">
          <Label>Connected to</Label>
          <p className="text-sm">{fixedContext.label}</p>
          {fixedContext.residentId ? (
            <input type="hidden" name="resident_id" value={fixedContext.residentId} />
          ) : null}
          {fixedContext.facilityId ? (
            <input type="hidden" name="facility_id" value={fixedContext.facilityId} />
          ) : null}
          {fixedContext.interactionId ? (
            <input type="hidden" name="interaction_id" value={fixedContext.interactionId} />
          ) : null}
        </div>
      ) : null}

      <Field label="What needs to be done?" htmlFor="title" error={fieldErrors.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={values.title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus={!task}
          placeholder="e.g. Call Mrs. Cohen's son about Shabbos meals"
          className="h-11"
        />
      </Field>

      {!task && similar.length > 0 ? (
        <div className="rounded-md border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm">
          <p className="font-medium text-[var(--tone-attention-fg)]">Already recorded? These look similar:</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {similar.map((t) => (
              <li key={t.id}>
                {/* A new tab, so what's typed here isn't lost. */}
                <Link href={`/tasks/${t.id}`} target="_blank" className="underline underline-offset-2">
                  {t.title}
                </Link>
                <span className="text-muted-foreground">
                  {" "}· {t.open ? "open" : "done"}
                  {t.about ? ` · ${t.about}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field label="More detail (optional)" htmlFor="description">
        <Textarea id="description" name="description" rows={2} defaultValue={values.description} />
      </Field>

      {/* No category to pick (decided Oct 8, 2026): the task says what
          it's about. An older task keeps the category it had. */}
      <input type="hidden" name="task_category" value={values.task_category || "other"} readOnly />
      {/* No urgency to choose (decided Oct 9, 2026): Today and overdue
          already say what comes first. An older task keeps its priority. */}
      <input type="hidden" name="priority" value={values.priority || "medium"} readOnly />

      <details open={showMore} className="group rounded-md border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex-1">Due date, who, facility (optional)</span>
          <span className="text-muted-foreground group-open:hidden">More</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due date" htmlFor="due_date" error={fieldErrors.due_date}>
          <Input id="due_date" name="due_date" type="date" defaultValue={values.due_date} />
        </Field>
        <Field label="Assigned to" htmlFor="assigned_to" error={fieldErrors.assigned_to}>
          <SelectField
            name="assigned_to"
            defaultValue={values.assigned_to}
            options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
            placeholder="Unassigned"
            allowEmpty
          />
        </Field>
      </div>

      {!fixedContext ? (
        <Field label="Facility" htmlFor="facility_id" error={fieldErrors.facility_id}>
          <FacilityPicker id="facility_id" name="facility_id" facilities={facilities} defaultValue={values.facility_id} emptyLabel="Not tied to a facility" />
        </Field>
      ) : null}
        </div>
      </details>

      <FormActions
        isPending={isPending}
        submitLabel={task ? "Save changes" : "Add task"}
        savingLabel={"Saving…"}
        hasUnsavedError={!!state.error}
      />
    </form>
  );
}

export type SimilarTask = { id: string; title: string; open: boolean; about: string | null; resident_id: string | null };

const COMMON_WORDS = new Set(["about", "call", "check", "with", "from", "that", "this", "follow", "visit", "their", "after", "need", "needs"]);

/** Tasks sharing a meaningful word with what's being typed (a name, a
 * place, "shabbos"...), the same resident's first. Just a hint -- it
 * never stops a save. */
function similarTasks(title: string, tasks: SimilarTask[], residentId?: string): SimilarTask[] {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9\u0590-\u05ff']+/)
    .filter((w) => w.length >= 4 && !COMMON_WORDS.has(w));
  if (words.length === 0) return [];
  return tasks
    .map((t) => {
      const text = `${t.title} ${t.about ?? ""}`.toLowerCase();
      const hits = words.filter((w) => text.includes(w)).length;
      return { t, score: hits + (residentId && t.resident_id === residentId && hits > 0 ? 1 : 0) + (t.open && hits > 0 ? 0.5 : 0) };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.t);
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
  placeholder,
  allowEmpty,
}: {
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Select value={value} onValueChange={(v) => setValue(v === "__none__" ? "" : v)}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value="__none__">{placeholder ?? "None"}</SelectItem>
          ) : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
