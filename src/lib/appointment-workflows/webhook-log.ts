/** Pure helpers for workflow webhook logging (safe to import from tests). */
export function webhookHostForLog(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}
