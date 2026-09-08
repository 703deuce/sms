import "server-only";

import type { BookingChannelIntegrationStatus } from "./types";
import { loadSchedulerTheme, saveSchedulerTheme } from "./scheduler-theme";

const CHANNEL_PROVIDERS: BookingChannelIntegrationStatus["provider"][] = [
  "google_reserve",
  "facebook",
  "instagram",
  "icloud_calendar",
];

export async function listBookingChannelIntegrations(workspaceId: string) {
  const theme = await loadSchedulerTheme(workspaceId);
  const existing = theme.bookingChannels || [];
  const byProvider = new Map(existing.map((c) => [c.provider, c]));
  return CHANNEL_PROVIDERS.map(
    (provider) =>
      byProvider.get(provider) || {
        provider,
        status: "not_connected" as const,
      },
  );
}

export async function updateBookingChannelIntegration(
  workspaceId: string,
  update: BookingChannelIntegrationStatus,
) {
  const theme = await loadSchedulerTheme(workspaceId);
  const channels = [...(theme.bookingChannels || [])];
  const idx = channels.findIndex((c) => c.provider === update.provider);
  if (idx >= 0) channels[idx] = update;
  else channels.push(update);
  await saveSchedulerTheme(workspaceId, { ...theme, bookingChannels: channels });
  return update;
}

/** Placeholder until Google Reserve / Meta partner onboarding completes. */
export function channelConnectInstructions(provider: BookingChannelIntegrationStatus["provider"]) {
  switch (provider) {
    case "google_reserve":
      return "Connect Reserve with Google via Google Business Profile after partner approval.";
    case "facebook":
      return "Add a Book Now action to your Facebook Page using the public booking URL.";
    case "instagram":
      return "Add an Instagram booking action using the public booking URL.";
    case "icloud_calendar":
      return "Apple Calendar two-way sync requires CalDAV credentials (provider integration pending).";
    default:
      return "";
  }
}
