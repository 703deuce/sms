const GRAPH = "https://graph.microsoft.com/v1.0";

/** Google-style "primary" is not a valid Graph calendar id on /calendars/{id}/calendarView. */
export function normalizeMicrosoftCalendarId(calendarId?: string | null): string | undefined {
  const raw = calendarId?.trim();
  if (!raw || raw === "primary") return undefined;
  return raw;
}

export function microsoftCalendarViewUrl(input: {
  calendarId?: string | null;
  mailboxUserPrincipalName?: string | null;
}): string {
  const user = input.mailboxUserPrincipalName?.trim()
    ? `${GRAPH}/users/${encodeURIComponent(input.mailboxUserPrincipalName.trim())}`
    : `${GRAPH}/me`;
  const calendarId = normalizeMicrosoftCalendarId(input.calendarId);
  if (calendarId) {
    return `${user}/calendars/${encodeURIComponent(calendarId)}/calendarView`;
  }
  return `${user}/calendar/calendarView`;
}

export function microsoftCreateEventUrl(input: {
  calendarId?: string | null;
  mailboxUserPrincipalName?: string | null;
}): string {
  const user = input.mailboxUserPrincipalName?.trim()
    ? `${GRAPH}/users/${encodeURIComponent(input.mailboxUserPrincipalName.trim())}`
    : `${GRAPH}/me`;
  const calendarId = normalizeMicrosoftCalendarId(input.calendarId);
  if (calendarId) {
    return `${user}/calendars/${encodeURIComponent(calendarId)}/events`;
  }
  return `${user}/calendar/events`;
}
