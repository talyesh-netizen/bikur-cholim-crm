"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClusterFormState = { error: string | null };

const nameSchema = z.string().trim().min(1, "Please enter a name.");

/**
 * These actions rely on the database's own admin-only security rule
 * (see geographic_clusters' RLS policy) as the real enforcement — a
 * non-admin's request will be rejected by Postgres regardless of what
 * this code does. The friendly error message here is just so a
 * non-admin who somehow reaches this action sees a clear explanation
 * instead of a raw database error.
 */
function friendlyClusterError(message: string) {
  if (message.toLowerCase().includes("row-level security")) {
    return "Only an admin can manage geographic clusters.";
  }
  if (message.toLowerCase().includes("duplicate key")) {
    return "A cluster with that name already exists.";
  }
  return "Something went wrong. Please try again.";
}

export async function createCluster(
  _prevState: ClusterFormState,
  formData: FormData
): Promise<ClusterFormState> {
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("geographic_clusters").insert({ name: parsed.data });

  if (error) {
    return { error: friendlyClusterError(error.message) };
  }

  revalidatePath("/settings/clusters");
  return { error: null };
}

export async function renameCluster(
  clusterId: string,
  _prevState: ClusterFormState,
  formData: FormData
): Promise<ClusterFormState> {
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("geographic_clusters")
    .update({ name: parsed.data })
    .eq("id", clusterId);

  if (error) {
    return { error: friendlyClusterError(error.message) };
  }

  revalidatePath("/settings/clusters");
  revalidatePath("/facilities");
  return { error: null };
}

export async function setClusterActive(clusterId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("geographic_clusters")
    .update({ active })
    .eq("id", clusterId);

  if (error) {
    throw new Error(friendlyClusterError(error.message));
  }

  revalidatePath("/settings/clusters");
  revalidatePath("/facilities");
}
