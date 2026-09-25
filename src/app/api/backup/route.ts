import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { buildZip } from "@/lib/zip";
import { csvRow, UTF8_BOM } from "@/lib/csv";
import { getLocalToday, formatDateTimeWithTime } from "@/lib/format-date";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

// Every table the CRM keeps, each with the columns that uniquely order
// its rows (so paging through 1,000 rows at a time never skips or
// repeats one).
const TABLES: { name: string; orderBy: string[] }[] = [
  { name: "facilities", orderBy: ["id"] },
  { name: "residents", orderBy: ["id"] },
  { name: "resident_facility_history", orderBy: ["id"] },
  { name: "contacts", orderBy: ["id"] },
  { name: "resident_contacts", orderBy: ["id"] },
  { name: "facility_contacts", orderBy: ["id"] },
  { name: "organizations", orderBy: ["id"] },
  { name: "organization_contacts", orderBy: ["id"] },
  { name: "interactions", orderBy: ["id"] },
  { name: "interaction_volunteers", orderBy: ["interaction_id", "contact_id"] },
  { name: "tasks", orderBy: ["id"] },
  { name: "profiles", orderBy: ["id"] },
  { name: "profile_facility_access", orderBy: ["profile_id", "facility_id"] },
  { name: "geographic_clusters", orderBy: ["id"] },
];

const PAGE_SIZE = 1000;

/**
 * Admin-only "download everything" backup: one ZIP with a spreadsheet
 * (CSV) per table plus a READ-ME. It reads through the admin's OWN
 * signed-in session, so the database's access rules still apply -- a
 * non-admin who found this URL gets nothing, and it never uses the
 * all-powerful service-role key.
 *
 * The file contains real resident information: it's sent with no-store
 * so browsers and proxies don't keep a copy, and the READ-ME says how to
 * store it.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can download a backup." }, { status: 403 });
  }

  const supabase = await createClient();
  const files: { name: string; content: string }[] = [];
  const counts: string[] = [];

  for (const table of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from(table.name).select("*");
      for (const column of table.orderBy) query = query.order(column, { ascending: true });
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      // A backup that's silently missing a table is worse than no backup:
      // fail the whole download loudly instead.
      if (error) {
        console.error(`[backup] could not read ${table.name}:`, error.message);
        return NextResponse.json(
          { error: `The backup could not be completed (couldn't read "${table.name}"). Nothing was downloaded. Please try again.` },
          { status: 500 }
        );
      }
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    let csv = UTF8_BOM + (columns.length > 0 ? csvRow(columns) : "");
    for (const row of rows) {
      csv += csvRow(columns.map((c) => row[c] as string | number | boolean | null));
    }
    files.push({ name: `${table.name}.csv`, content: csv });
    counts.push(`  ${table.name}.csv — ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }

  const today = getLocalToday();
  const readme = [
    `${ORGANIZATION_NAME} — ${APP_NAME} CRM backup`,
    `Downloaded ${formatDateTimeWithTime(new Date().toISOString())} (Cleveland time) by ${profile.full_name}`,
    "",
    "CONTAINS REAL RESIDENT INFORMATION. Store it only somewhere private and",
    "access-controlled (e.g. the organization's protected shared drive). Do not",
    "email it, and delete old copies you no longer need.",
    "",
    "One spreadsheet per table (open with Excel, Numbers or Google Sheets):",
    ...counts,
    "",
    "Records link to each other by their id columns (e.g. residents.current_facility_id",
    "is a facilities.id). Times are stored in UTC; dates are plain calendar days.",
  ].join("\r\n");
  files.unshift({ name: "READ-ME.txt", content: readme });

  const zip = buildZip(files);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="crm-backup-${today}.zip"`,
      "Cache-Control": "no-store, private",
    },
  });
}
