/** Remove unreplaced merge tokens and empty manage/reschedule link phrases from outbound SMS. */
export function finalizeReminderSmsBody(body: string): string {
  let out = body.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, "").trim();
  out = out
    .replace(/\s*Manage:\s*$/gim, "")
    .replace(/\s*Manage appointment:\s*$/gim, "")
    .replace(/\s*Reschedule:\s*$/gim, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}
