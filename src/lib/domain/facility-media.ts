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
