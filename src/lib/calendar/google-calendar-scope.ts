/** V1 Voice V3 / Appointment Receptionist — narrow owned-events scope only. */
export const GOOGLE_CALENDAR_EVENTS_OWNED_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned";

export function googleCalendarOAuthScopes(): string {
  return GOOGLE_CALENDAR_EVENTS_OWNED_SCOPE;
}
