/**
 * Sends one email through Resend (resend.com). Returns false without
 * sending when RESEND_API_KEY or TASK_REMINDER_FROM_EMAIL isn't set, so
 * nothing breaks before email is configured. Never throws.
 *
 * Privacy: anything passed here leaves the CRM for good. Follow the rule
 * in PRIVACY_AND_SECURITY.md -- send the minimum, link back to the CRM for
 * details; never resident/facility names, task titles or notes.
 */
export async function sendEmail(to: string, message: { subject: string; html: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TASK_REMINDER_FROM_EMAIL;
  if (!apiKey || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, ...message }),
    });
    if (!res.ok) console.error(`[email] provider returned ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error("[email] sending failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
