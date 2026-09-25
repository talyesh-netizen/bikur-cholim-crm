import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

/**
 * Shared email plumbing for the two task emails: the instant "new task
 * assigned to you" notice (lib/notify-task-assigned.ts) and the daily
 * due/overdue digest (app/api/cron/task-reminders). Both send through
 * Resend, a transactional email API, and both quietly do nothing until
 * RESEND_API_KEY is set -- so nothing breaks before email is configured.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The simple, consistent frame every task email is wrapped in. */
export function emailLayout(bodyHtml: string, footerReason: string): string {
  return `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
        ${bodyHtml}
        <p style="color:#999;font-size:12px;margin-top:32px;">${escapeHtml(ORGANIZATION_NAME)} &middot; ${escapeHtml(APP_NAME)} CRM &middot; ${escapeHtml(footerReason)}</p>
      </div>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
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
