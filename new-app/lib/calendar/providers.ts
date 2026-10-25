/** Stored on VoiceCalendarConnection.config (integrations + legacy voice). */
export type CalendarConfig = Record<string, unknown> & {
  productContext?: string
}

/** Provider calendar event shape for Voice V3 appointment discovery (new-app). */
export type ProviderCalendarEvent = {
  id: string;
  subject?: string;
  start?: string;
  end?: string;
  organizer?: string;
};
