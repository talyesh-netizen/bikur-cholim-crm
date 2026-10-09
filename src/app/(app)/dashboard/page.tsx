import { getDashboardSummary } from "@/lib/queries/dashboard";
import { listFacilities } from "@/lib/queries/facilities";
import { listInteractionsByStaffOnDay } from "@/lib/queries/interactions";
import { createClient } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/format-date";
import { TodayView } from "./today-view";
import { ORGANIZATION_TIMEZONE } from "@/lib/config";

/** The server (Vercel) runs in UTC, not Cleveland time, so reading the
 * hour/date directly off `new Date()` here could show "Good evening" at
 * 9am or the wrong weekday -- read both in the org's own timezone instead. */
function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { timeZone: ORGANIZATION_TIMEZONE, hour: "numeric", hour12: false })
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Today answers one question: what do I do today? (Decided Oct 9, 2026.)
 * Three things, in order: start or carry on a visit, my follow-ups due,
 * and what I logged today. Counts, charts and lists live under the menu.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [summary, facilities, mine, profileRow] = await Promise.all([
    getDashboardSummary(),
    listFacilities(),
    user ? listInteractionsByStaffOnDay(user.id, getLocalToday()) : Promise.resolve([]),
    user ? supabase.from("profiles").select("full_name").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const firstName = profileRow.data?.full_name?.split(" ")[0] ?? "";

  // Mine, plus anything no one has been given yet.
  const due = [...summary.overdueTasks, ...summary.dueTodayTasks].filter(
    (task) => !task.assigned_to || task.assigned_to === user?.id
  );
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <TodayView
      heading={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
      today={today}
      facilities={facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        address: facility.address,
        city: facility.city,
        zip: facility.zip,
      }))}
      due={due}
      mine={mine}
      staleResidentsTotal={summary.staleResidentsTotal}
    />
  );
}
