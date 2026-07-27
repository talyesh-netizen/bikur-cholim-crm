"use client";

import { useActionState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCluster, type ClusterFormState } from "@/lib/actions/clusters";

export function NewClusterForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<ClusterFormState, FormData>(
    async (prevState, formData) => {
      const result = await createCluster(prevState, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    { error: null }
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="New cluster name, e.g., West Side" required />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add cluster"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
