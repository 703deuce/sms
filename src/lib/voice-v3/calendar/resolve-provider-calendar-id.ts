/** Wizard / config sentinels — not Microsoft or Google calendar resource ids. */
export function isVoiceV3ProviderCalendarSentinel(calendarId: string | undefined): boolean {
  const id = calendarId?.trim().toLowerCase();
  return !id || id === "primary" || id === "default";
}

/** Microsoft Graph: omit calendar id to use default mailbox calendar. */
export function resolveMicrosoftGraphCalendarId(
  calendarId: string | undefined,
): string | undefined {
  if (isVoiceV3ProviderCalendarSentinel(calendarId)) return undefined;
  return calendarId!.trim();
}
