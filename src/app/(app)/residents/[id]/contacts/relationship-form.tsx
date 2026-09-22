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
import { RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import type { RelationshipFormState } from "@/lib/actions/resident-contacts";
import type { ResidentContact } from "@/lib/domain/contact";

type Action = (state: RelationshipFormState, formData: FormData) => Promise<RelationshipFormState>;

function toFormValues(residentContact: ResidentContact): Record<string, string> {
  return {
    relationship_to_resident: residentContact.relationship_to_resident,
    relationship_other_description: residentContact.relationship_other_description ?? "",
    relationship_notes: residentContact.relationship_notes ?? "",
  };
}

export function RelationshipForm({
  action,
  residentContact,
}: {
  action: Action;
  residentContact: ResidentContact;
}) {
  const [state, formAction, isPending] = useActionState<RelationshipFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? toFormValues(residentContact);
  const formKey = JSON.stringify(values);
  const [relationship, setRelationship] = useState(values.relationship_to_resident);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Relationship to resident"
        htmlFor="relationship_to_resident"
        error={fieldErrors.relationship_to_resident}
        required
      >
        <SelectField
          name="relationship_to_resident"
          value={relationship}
          onValueChange={setRelationship}
          options={RESIDENT_CONTACT_RELATIONSHIPS}
          placeholder="Choose a relationship…"
        />
      </Field>

      {relationship === "other" ? (
        <Field
          label="Describe the relationship"
          htmlFor="relationship_other_description"
          error={fieldErrors.relationship_other_description}
          required
        >
          <Input
            id="relationship_other_description"
            name="relationship_other_description"
            defaultValue={values.relationship_other_description}
          />
        </Field>
      ) : (
        <input
          type="hidden"
          name="relationship_other_description"
          value={values.relationship_other_description ?? ""}
          readOnly
        />
      )}

      <Field label="Notes about this relationship" htmlFor="relationship_notes">
        <Textarea
          id="relationship_notes"
          name="relationship_notes"
          rows={3}
          defaultValue={values.relationship_notes}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
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
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  options,
  placeholder,
}: {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;
  const setValue = controlledOnValueChange ?? setInternalValue;

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
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
