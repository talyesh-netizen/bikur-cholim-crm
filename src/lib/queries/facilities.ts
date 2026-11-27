import { createClient } from "@/lib/supabase/server";
import type { FacilityWithSummary, GeographicCluster } from "@/lib/domain/facility";
import { matchFacilities } from "@/lib/facility-match";

export type FacilityFilters = {
  search?: string;
  clusterId?: string;
  engagementStatus?: string;
  visitPriority?: string;
  facilityType?: string;
  showInactive?: boolean;
  /** Only facilities where at least one active resident we serve lives
   * now -- worked out live from the residents list, so it updates by
   * itself when a resident is added, moves, or stops receiving services. */
  withResidents?: boolean;
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
  if (filters.withResidents) {
    query = query.gt("active_resident_count", 0);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FacilityWithSummary[];
  // One search rule across the CRM (Nov 27, 2026): the same forgiving
  // match as every facility picker ("saint joseph", "landerhaven", initials,
  // city or healthcare group), not the database's plain word match.
  return filters.search?.trim() ? matchFacilities(rows, filters.search) : rows;
}

/** The other kinds of care a facility offers besides its main type
 * ("also offers"), read from the facility itself. */
export async function getFacilityAlsoOffers(id: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facilities").select("also_offers").eq("id", id).maybeSingle();
  if (error || !data) return [];
  return (data.also_offers as string[] | null) ?? [];
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

export async function listFacilityOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
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
