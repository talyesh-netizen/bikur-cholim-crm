import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import { getLocalToday } from "@/lib/format-date";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Privacy: email leaves the CRM and sits in inboxes, phones and mail
 * servers we don't control, so this reminder deliberately says as little
 * as possible -- only HOW MANY follow-ups are due or overdue, with a link
 * back into the CRM (where sign-in and facility access rules apply). No
 * resident names, facility names, task titles, categories or notes are
 * ever put in the email; task titles are free text and often name a
 * resident or family member. See PRIVACY_AND_SECURITY.md.
 */

function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function renderEmail(staffId: string, staffName: string, overdue: number, dueToday: number) {
  const base = siteUrl();
  const firstName = staffName.trim().split(/\s+/)[0] || "there";
  const lines = [
    overdue > 0 ? `<li style="color:#b91c1c;">${plural(overdue, "overdue follow-up")}</li>` : "",
    dueToday > 0 ? `<li>${plural(dueToday, "follow-up")} due today</li>` : "",
  ].join("");
  const tasksLink = `${base}/tasks?view=list&assigned=${encodeURIComponent(staffId)}`;

  return {
    subject: `${APP_NAME}: you have follow-ups waiting`,
    html: `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>You have:</p>
        <ul>${lines}</ul>
        <p><a href="${tasksLink}" style="color:#1a1a1a;font-weight:600;">Open your tasks in the CRM &rarr;</a></p>
        <p style="color:#666;font-size:13px;">For privacy, details stay in the CRM -- sign in to see them.</p>
        <p style="color:#999;font-size:12px;margin-top:32px;">${escapeHtml(ORGANIZATION_NAME)} &middot; ${escapeHtml(APP_NAME)} &middot; You're receiving this because you have open follow-up tasks assigned to you.</p>
      </div>`,
    text: [
      `Hi ${firstName},`,
      "",
      "You have:",
      overdue > 0 ? `- ${plural(overdue, "overdue follow-up")}` : "",
      dueToday > 0 ? `- ${plural(dueToday, "follow-up")} due today` : "",
      "",
      `Open your tasks in the CRM: ${tasksLink}`,
      "For privacy, details stay in the CRM -- sign in to see them.",
    ]
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .join("\n"),
  };
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  message: { subject: string; html: string; text: string }
): Promise<{ ok: boolean; status?: number }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, ...message }),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * Daily digest, not an instant per-task ping: once a day, every active
 * staff member with an overdue or due-today open task gets one email
 * saying how many. Triggered by Vercel Cron (see vercel.json) -- there's
 * no signed-in user for a cron request, so this is one of the few
 * legitimate uses of the service-role client (see its own comment).
 *
 * Fails closed: without CRON_SECRET configured, or without the exact
 * matching Authorization header Vercel Cron sends, nothing runs. Only
 * set CRON_SECRET on the ONE production Vercel project, so a duplicate
 * project deploying the same code can never send a second set of emails.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TASK_REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[task-reminders] skipped: RESEND_API_KEY and/or TASK_REMINDER_FROM_EMAIL not configured");
    return NextResponse.json({ skipped: true, reason: "Email sending is not configured" });
  }

  const supabase = createAdminClient();
  const today = getLocalToday();

  // Only what's needed to count and address -- no resident, facility or
  // task text is read at all.
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, due_date, profiles!tasks_assigned_to_fkey(id, full_name, email, active)")
    .not("assigned_to", "is", null)
    .not("due_date", "is", null)
    .lte("due_date", today)
    .in("status", OPEN_TASK_STATUSES as unknown as string[]);

  if (error) {
    console.error("[task-reminders] could not load tasks:", error.message);
    return NextResponse.json({ error: "Could not load tasks" }, { status: 500 });
  }

  type Row = {
    id: string;
    due_date: string;
    profiles: { id: string; full_name: string; email: string; active: boolean } | null;
  };

  const byStaff = new Map<string, { name: string; email: string; overdue: number; dueToday: number }>();
  for (const row of (tasks ?? []) as unknown as Row[]) {
    const staff = row.profiles;
    if (!staff || !staff.active || !staff.email) continue;
    const entry = byStaff.get(staff.id) ?? { name: staff.full_name, email: staff.email, overdue: 0, dueToday: 0 };
    if (row.due_date < today) entry.overdue += 1;
    else entry.dueToday += 1;
    byStaff.set(staff.id, entry);
  }

  let sent = 0;
  let failed = 0;
  for (const [staffId, { name, email, overdue, dueToday }] of byStaff) {
    try {
      const result = await sendEmail(apiKey, from, email, renderEmail(staffId, name, overdue, dueToday));
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        console.error(`[task-reminders] email provider returned ${result.status} for staff ${staffId}`);
      }
    } catch (e) {
      failed += 1;
      console.error(`[task-reminders] sending failed for staff ${staffId}:`, e instanceof Error ? e.message : e);
    }
  }

  // A non-2xx status makes a partial failure visible in Vercel's cron
  // and log views instead of looking like a clean run.
  return NextResponse.json({ date: today, staffWithTasks: byStaff.size, sent, failed }, { status: failed > 0 ? 502 : 200 });
}
