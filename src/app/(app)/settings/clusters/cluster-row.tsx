"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { renameCluster, setClusterActive, type ClusterFormState } from "@/lib/actions/clusters";
import type { GeographicCluster } from "@/lib/domain/facility";

export function ClusterRow({ cluster }: { cluster: GeographicCluster }) {
  const action = renameCluster.bind(null, cluster.id);
  const [state, formAction, isPending] = useActionState<ClusterFormState, FormData>(action, {
    error: null,
  });

  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex flex-1 items-center gap-2">
          <Input
            name="name"
            defaultValue={cluster.name}
            disabled={!cluster.active}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" variant="outline" disabled={isPending || !cluster.active}>
            Save
          </Button>
        </form>
        <form
          action={async () => {
            await setClusterActive(cluster.id, !cluster.active);
          }}
        >
          <Button type="submit" size="sm" variant="ghost">
            {cluster.active ? "Retire" : "Reactivate"}
          </Button>
        </form>
      </div>
      {!cluster.active ? (
        <p className="text-xs text-muted-foreground">
          Retired — hidden from new facility forms, but existing facilities using it are unaffected.
        </p>
      ) : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}
