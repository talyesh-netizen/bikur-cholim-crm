import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { formatDateOnly } from "@/lib/format-date";
import { getSiteUrl } from "@/lib/site-url";
import { escapeHtml, sendEmail } from "@/lib/email";

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || "there";

/**
 * Instant "a task was just assigned to you" email, sent the moment a task
 * is created for someone or handed over to them -- so it reaches their
 * inbox right away instead of only once it's due (the daily reminder in
 * app/api/cron/task-reminders covers due/overdue). Nothing is sent when
 * you assign a task to yourself.
 *
 * Privacy (see PRIVACY_AND_SECURITY.md): like the daily reminder, this
 * says only WHO assigned it and WHEN it's due, with a link back into the
 * CRM. No task title, notes, resident or facility -- titles are free
 * text and often name a resident or relative.
 *
 * Never throws: a failed email must not block or undo saving the task.
 */
export async function notifyTaskAssigned(
  supabase: SupabaseClient,
  taskId: string,
  assignedById: string | undefined
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.TASK_REMINDER_FROM_EMAIL) return;

  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, due_date, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name, email, active)")
      .eq("id", taskId)
      .single();

    const task = data as unknown as {
      id: string;
      due_date: string | null;
      assigned_to: string | null;
      assignee: { full_name: string; email: string; active: boolean } | null;
    } | null;
    if (!task || !task.assigned_to || task.assigned_to === assignedById) return;
    if (!task.assignee?.email || !task.assignee.active) return;

    let assignedBy: string | null = null;
    if (assignedById) {
      const { data: me } = await supabase.from("profiles").select("full_name").eq("id", assignedById).single();
      assignedBy = me?.full_name ?? null;
    }

    const firstName = firstNameOf(task.assignee.full_name);
    const who = assignedBy ? `${assignedBy} assigned you a new follow-up task` : "You've been assigned a new follow-up task";
    const due = task.due_date ? `It's due ${formatDateOnly(task.due_date)}.` : "It has no due date.";
    const link = `${getSiteUrl()}/tasks/${task.id}`;

    await sendEmail(task.assignee.email, {
      subject: `${APP_NAME}: a new task was assigned to you`,
      html: `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>${escapeHtml(who)} in the CRM. ${escapeHtml(due)}</p>
        <p><a href="${link}" style="color:#1a1a1a;font-weight:600;">Open the task in the CRM &rarr;</a></p>
        <p style="color:#666;font-size:13px;">For privacy, details stay in the CRM -- sign in to see them.</p>
        <p style="color:#999;font-size:12px;margin-top:32px;">${escapeHtml(ORGANIZATION_NAME)} &middot; ${escapeHtml(APP_NAME)} &middot; You're receiving this because a task was assigned to you.</p>
      </div>`,
      text: [
        `Hi ${firstName},`,
        "",
        `${who} in the CRM. ${due}`,
        "",
        `Open the task in the CRM: ${link}`,
        "For privacy, details stay in the CRM -- sign in to see them.",
      ].join("\n"),
    });
  } catch (e) {
    console.error("[task-assigned] email failed:", e instanceof Error ? e.message : e);
  }
}
