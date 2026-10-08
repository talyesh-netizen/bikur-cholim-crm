import { createClient } from "@/lib/supabase/server";

import type { FacilityMedia } from "@/lib/domain/facility-media";

export async function listFacilityMedia(facilityId: string): Promise<FacilityMedia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facility_media")
    .select("id, facility_id, interaction_id, storage_path, original_filename, mime_type, size_bytes, sha256, caption, usage_scope, created_by, created_at, interactions(id, occurred_at, interaction_type, holiday, notes)")
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return Promise.all(
    (data ?? []).map(async (row) => {
      const raw = row as unknown as Omit<FacilityMedia, "signed_url" | "interaction"> & {
        interactions: FacilityMedia["interaction"];
      };
      const { data: signed } = await supabase.storage
        .from("impact-media")
        .createSignedUrl(raw.storage_path, 60 * 10);

      return {
        ...raw,
        signed_url: signed?.signedUrl ?? null,
        interaction: raw.interactions ?? null,
      } as FacilityMedia;
    })
  );
}
