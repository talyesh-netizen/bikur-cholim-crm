import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_TASK_STATUSES, TASK_CATEGORIES, labelFor } from "@/lib/domain/task";
import { getLocalToday, formatDateOnly } from "@/lib/format-date";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** One row of the digest: a task plus enough context to make the email
 * useful without opening the app. */
type ReminderTask = {
  id: string;
  title: string;
  due_date: string;
  task_category: string;
  resident_name: string | null;
  facility_name: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderEmail(staffName: string, overdue: ReminderTask[], dueToday: ReminderTask[]): { subject: string; html: string } {
  const base = getSiteUrl();
  const row = (t: ReminderTask, isOverdue: boolean) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">
        <a href="${base}/tasks/${t.id}" style="color:#1a1a1a;text-decoration:none;font-weight:600;">${escapeHtml(t.title)}</a><br/>
        <span style="color:#666;font-size:13px;">
          ${labelFor(TASK_CATEGORIES, t.task_category)}
          ${t.resident_name ? ` &middot; ${escapeHtml(t.resident_name)}` : ""}
          ${t.facility_name ? ` &middot; ${escapeHtml(t.facility_name)}` : ""}
          &middot; <span style="color:${isOverdue ? "#b91c1c" : "#666"};">${isOverdue ? "Overdue &mdash; was due " : "Due "}${formatDateOnly(t.due_date)}</span>
        </span>
      </td>
    </tr>`;

  const sections = [
    overdue.length > 0 ? `<h3 style="color:#b91c1c;margin:20px 0 4px;">Overdue (${overdue.length})</h3><table width="100%" cellpadding="0" cellspacing="0">${overdue.map((t) => row(t, true)).join("")}</table>` : "",
    dueToday.length > 0 ? `<h3 style="margin:20px 0 4px;">Due today (${dueToday.length})</h3><table width="100%" cellpadding="0" cellspacing="0">${dueToday.map((t) => row(t, false)).join("")}</table>` : "",
  ].join("");

  const total = overdue.length + dueToday.length;
  return {
    subject: `${total} task${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} your attention`,
    html: `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
        <p>Hi ${escapeHtml(staffName)},</p>
        <p>Here's your daily follow-up task summary from the ${escapeHtml(APP_NAME)} CRM.</p>
        ${sections}
        <p style="margin-top:24px;"><a href="${base}/tasks" style="color:#1a1a1a;">Open your tasks &rarr;</a></p>
        <p style="color:#999;font-size:12px;margin-top:32px;">${escapeHtml(ORGANIZATION_NAME)} &middot; You're receiving this because you have open follow-up tasks assigned to you.</p>
      </div>`,
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set" };

  const from = process.env.TASK_REMINDER_FROM_EMAIL ?? "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) return { ok: false, error: `Resend returned ${res.status}: ${await res.text()}` };
  return { ok: true };
}

/**
 * Daily digest, not an instant per-task ping: once a day, every active
 * staff member with an overdue or due-today open task gets one email
 * listing all of them. Triggered by Vercel Cron (see vercel.json) --
 * there's no signed-in user for a cron request, so this is one of the
 * few legitimate uses of the service-role client (see its own comment).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured yet" });
  }

  const supabase = createAdminClient();
  const today = getLocalToday();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, title, due_date, task_category, assigned_to, residents(first_name, last_name, preferred_name), facilities(name), profiles!tasks_assigned_to_fkey(id, full_name, email, active)"
    )
    .not("assigned_to", "is", null)
    .not("due_date", "is", null)
    .lte("due_date", today)
    .in("status", OPEN_TASK_STATUSES as unknown as string[]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    title: string;
    due_date: string;
    task_category: string;
    assigned_to: string;
    residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
    facilities: { name: string } | null;
    profiles: { id: string; full_name: string; email: string; active: boolean } | null;
  };

  const byStaff = new Map<string, { name: string; email: string; overdue: ReminderTask[]; dueToday: ReminderTask[] }>();
  for (const row of (tasks ?? []) as unknown as Row[]) {
    const staff = row.profiles;
    if (!staff || !staff.active) continue;

    const entry =
      byStaff.get(staff.id) ?? { name: staff.full_name, email: staff.email, overdue: [], dueToday: [] };
    const reminderTask: ReminderTask = {
      id: row.id,
      title: row.title,
      due_date: row.due_date,
      task_category: row.task_category,
      resident_name: row.residents
        ? `${row.residents.preferred_name ?? row.residents.first_name} ${row.residents.last_name}`
        : null,
      facility_name: row.facilities?.name ?? null,
    };
    if (row.due_date < today) entry.overdue.push(reminderTask);
    else entry.dueToday.push(reminderTask);
    byStaff.set(staff.id, entry);
  }

  const results: { staff: string; sent: boolean; error?: string }[] = [];
  for (const { name, email, overdue, dueToday } of byStaff.values()) {
    const { subject, html } = renderEmail(name, overdue, dueToday);
    const result = await sendEmail(email, subject, html);
    results.push({ staff: name, sent: result.ok, error: result.error });
  }

  return NextResponse.json({ staffNotified: results.length, results });
}
