import { createClient } from "@/lib/supabase/server";

export const MEDIA_USAGE_SCOPES = [
  { value: "internal_only", label: "Internal only" },
  { value: "approved_for_reporting", label: "Approved for reporting" },
  { value: "approved_for_public", label: "Approved for public use" },
] as const;

export type MediaUsageScope = (typeof MEDIA_USAGE_SCOPES)[number]["value"];

export type FacilityMedia = {
  id: string;
  facility_id: string;
  interaction_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  caption: string | null;
  usage_scope: MediaUsageScope;
  created_by: string;
  created_at: string;
  signed_url: string | null;
  interaction: {
    id: string;
    occurred_at: string;
    interaction_type: string;
    holiday: string | null;
    notes: string | null;
  } | null;
};

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
