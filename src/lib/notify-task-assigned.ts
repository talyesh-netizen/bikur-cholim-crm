import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_CATEGORIES, TASK_PRIORITIES, labelFor } from "@/lib/domain/task";
import { formatDateOnly } from "@/lib/format-date";
import { getSiteUrl } from "@/lib/site-url";
import { emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * Instant "a task was just assigned to you" email, sent the moment a
 * task is created for someone or handed over to them -- so it lands in
 * their inbox right away rather than only once it's due (the daily
 * digest covers due/overdue). Skipped when you assign a task to
 * yourself, since you already know about it.
 *
 * Never throws: a failed email must not undo or block saving the task.
 */
export async function notifyTaskAssigned(
  supabase: SupabaseClient,
  taskId: string,
  assignedById: string | undefined
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const { data } = await supabase
      .from("tasks")
      .select(
        "id, title, description, due_date, priority, task_category, assigned_to, residents(first_name, last_name, preferred_name), facilities(name), assignee:profiles!tasks_assigned_to_fkey(full_name, email, active)"
      )
      .eq("id", taskId)
      .single();

    type Row = {
      id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      priority: string;
      task_category: string;
      assigned_to: string | null;
      residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
      facilities: { name: string } | null;
      assignee: { full_name: string; email: string; active: boolean } | null;
    };
    const task = data as unknown as Row | null;
    if (!task || !task.assigned_to || task.assigned_to === assignedById) return;
    if (!task.assignee?.email || !task.assignee.active) return;

    let assignedByName: string | null = null;
    if (assignedById) {
      const { data: me } = await supabase.from("profiles").select("full_name").eq("id", assignedById).single();
      assignedByName = me?.full_name ?? null;
    }

    const residentName = task.residents
      ? `${task.residents.preferred_name ?? task.residents.first_name} ${task.residents.last_name}`
      : null;
    const link = `${getSiteUrl()}/tasks/${task.id}`;
    const detail = (label: string, value: string | null) =>
      value ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">${label}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>` : "";

    const body = `
        <p>Hi ${escapeHtml(task.assignee.full_name)},</p>
        <p>${assignedByName ? `${escapeHtml(assignedByName)} assigned` : "You've been assigned"} a new task${assignedByName ? " to you" : ""}:</p>
        <p style="font-size:18px;font-weight:600;margin:16px 0 8px;"><a href="${link}" style="color:#1a1a1a;text-decoration:none;">${escapeHtml(task.title)}</a></p>
        <table cellpadding="0" cellspacing="0" style="font-size:14px;">
          ${detail("Due", task.due_date ? formatDateOnly(task.due_date) : "No due date")}
          ${detail("Priority", labelFor(TASK_PRIORITIES, task.priority))}
          ${detail("Type", labelFor(TASK_CATEGORIES, task.task_category))}
          ${detail("Resident", residentName)}
          ${detail("Facility", task.facilities?.name ?? null)}
        </table>
        ${task.description ? `<p style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px;">${escapeHtml(task.description)}</p>` : ""}
        <p style="margin-top:24px;"><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Open this task &rarr;</a></p>`;

    await sendEmail(
      task.assignee.email,
      `New task: ${task.title}`,
      emailLayout(body, "You're receiving this because a task was assigned to you.")
    );
  } catch (err) {
    console.error("Task-assigned email failed", err);
  }
}
