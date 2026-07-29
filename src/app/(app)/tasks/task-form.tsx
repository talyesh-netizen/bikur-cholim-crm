"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { TASK_CATEGORIES, TASK_PRIORITIES } from "@/lib/domain/task";
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
}: {
  action: Action;
  task?: Task;
  staff: { id: string; full_name: string }[];
  facilities: { id: string; name: string }[];
  /** Set when creating a task from a resident/facility/interaction page
   * — that connection is fixed rather than user-editable. */
  fixedContext?: { label: string; residentId?: string; facilityId?: string; interactionId?: string };
}) {
  const [state, formAction, isPending] = useActionState<TaskFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? {
    ...taskToFormValues(task),
    resident_id: fixedContext?.residentId ?? "",
    facility_id: fixedContext?.facilityId ?? "",
    interaction_id: fixedContext?.interactionId ?? "",
  };
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

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

      <Field label="Title" htmlFor="title" error={fieldErrors.title} required>
        <Input id="title" name="title" defaultValue={values.title} required />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={values.description} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="task_category" error={fieldErrors.task_category} required>
          <SelectField
            name="task_category"
            defaultValue={values.task_category}
            options={TASK_CATEGORIES}
            placeholder="Choose a category…"
          />
        </Field>
        <Field label="Priority" htmlFor="priority" error={fieldErrors.priority} required>
          <SelectField name="priority" defaultValue={values.priority} options={TASK_PRIORITIES} />
        </Field>
      </div>

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
          <SelectField
            name="facility_id"
            defaultValue={values.facility_id}
            options={facilities.map((f) => ({ value: f.id, label: f.name }))}
            placeholder="Not tied to a facility"
            allowEmpty
          />
        </Field>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : task ? "Save changes" : "Add task"}
        </Button>
      </div>
    </form>
  );
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
