import { createClient } from "@/lib/supabase/server";

export type ChangeLogEntry = {
  id: number;
  table_name: string;
  record_id: string;
  action: "update" | "delete";
  changed_at: string;
  changed_by_name: string;
  changes: Record<string, unknown>;
};

type Row = Omit<ChangeLogEntry, "changed_by_name"> & { changed_by: string | null };

/** Change history (see supabase/migrations/20261002000003_change_log.sql).
 * The database only lets admins read it, so for anyone else this simply
 * returns nothing. */
async function withNames(rows: Row[]): Promise<ChangeLogEntry[]> {
  const supabase = await createClient();
  const ids = [...new Set(rows.map((r) => r.changed_by).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.full_name);
  }
  return rows.map(({ changed_by, ...r }) => ({
    ...r,
    changed_by_name: changed_by ? names.get(changed_by) ?? "Unknown staff member" : "Direct database edit",
  }));
}

export async function listChangesForRecord(tableName: string, recordId: string, limit = 25) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("change_log")
    .select("id, table_name, record_id, action, changed_at, changed_by, changes")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return withNames((data ?? []) as Row[]);
}

export async function listRecentChanges(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("change_log")
    .select("id, table_name, record_id, action, changed_at, changed_by, changes")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return withNames((data ?? []) as Row[]);
}
