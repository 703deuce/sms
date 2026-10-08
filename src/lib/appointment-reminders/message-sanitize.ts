/** Remove unreplaced merge tokens and empty manage/reschedule link phrases from outbound SMS. */
export function finalizeReminderSmsBody(body: string): string {
  let out = body.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, "").trim();
  out = out
    .replace(/\s*Manage:\s*$/gim, "")
    .replace(/\s*Manage appointment:\s*$/gim, "")
    .replace(/\s*Reschedule:\s*$/gim, "")
    .replace(/\s*Manage:\s*/gi, " ")
    .replace(/\s*Manage appointment:\s*/gi, " ")
    .replace(/\s*Reschedule:\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

/** Platform AR uses reply letters (C/R/X), not customer login URLs. */
export function stripHttpUrlsFromSmsBody(body: string): string {
  return body
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\s+Reply\s+YES\s+to\s+confirm\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
