/** Quick Log needs the AI key. Until an admin adds it in Vercel, every
 * way into Quick Log is hidden so nobody taps into a dead end. Server
 * only (reads a server environment variable). */
export function quickLogEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}
