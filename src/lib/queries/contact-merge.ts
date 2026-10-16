import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Remembered once true: the field never goes away after it is added.
let mergeFieldReady = false;

/**
 * Whether contacts have the "Merged into" field yet
 * (supabase/migrations/20261016000001_contact_merged_into.sql). Until
 * that change is applied to a database, the screens that read it
 * behave exactly as before instead of failing -- so a preview running
 * against a database without it still works.
 */
export async function contactMergeReady(supabase?: Client): Promise<boolean> {
  if (mergeFieldReady) return true;
  const client = supabase ?? (await createClient());
  const { error } = await client.from("contacts").select("merged_into_id").limit(0);
  mergeFieldReady = !error;
  return mergeFieldReady;
}

export type MergeInfo = {
  /** The record this one was merged into, when it is a verified duplicate. */
  mergedInto: { id: string; name: string } | null;
  /** Duplicates that were merged into this record. */
  duplicates: { id: string; name: string }[];
};

export async function getMergeInfo(contactId: string, mergedIntoId: string | null | undefined): Promise<MergeInfo> {
  const supabase = await createClient();
  if (!(await contactMergeReady(supabase))) return { mergedInto: null, duplicates: [] };
  const [into, dups] = await Promise.all([
    mergedIntoId
      ? supabase.from("contacts").select("id, name").eq("id", mergedIntoId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("contacts").select("id, name").eq("merged_into_id", contactId).order("name"),
  ]);
  return {
    mergedInto: (into.data as { id: string; name: string } | null) ?? null,
    duplicates: (dups.data ?? []) as { id: string; name: string }[],
  };
}
