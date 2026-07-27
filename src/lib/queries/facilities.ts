import { createClient } from "@/lib/supabase/server";
import type { FacilityWithSummary, GeographicCluster } from "@/lib/domain/facility";

export type FacilityFilters = {
  search?: string;
  clusterId?: string;
  engagementStatus?: string;
  visitPriority?: string;
  facilityType?: string;
  showInactive?: boolean;
};

export async function listFacilities(filters: FacilityFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("facility_summary")
    .select("*")
    .order("name", { ascending: true });

  if (!filters.showInactive) {
    query = query.eq("active", true);
  }
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
  }
  if (filters.clusterId) {
    query = query.eq("geographic_cluster_id", filters.clusterId);
  }
  if (filters.engagementStatus) {
    query = query.eq("engagement_status", filters.engagementStatus);
  }
  if (filters.visitPriority) {
    query = query.eq("visit_priority", filters.visitPriority);
  }
  if (filters.facilityType) {
    query = query.eq("facility_type", filters.facilityType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FacilityWithSummary[];
}

export async function getFacility(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facility_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as FacilityWithSummary;
}

export async function listGeographicClusters(includeInactive = false) {
  const supabase = await createClient();
  let query = supabase
    .from("geographic_clusters")
    .select("*")
    .order("display_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as GeographicCluster[];
}
