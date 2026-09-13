export function logMctbAiBookingEvent(
  event: string,
  detail: Record<string, unknown>,
) {
  const safe = { ...detail };
  for (const k of Object.keys(safe)) {
    if (/token|secret|password|authorization/i.test(k)) delete safe[k];
  }
  console.info(`[mctb-ai-booking] ${event}`, safe);
}
