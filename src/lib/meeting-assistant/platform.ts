import type { MeetingPlatform } from "./types";

export function detectMeetingPlatform(url: string): MeetingPlatform {
  const u = url.trim().toLowerCase();
  if (!u) return "unsupported";
  if (u.includes("/video/")) return "transovo_video";
  if (u.includes("zoom.us") || u.includes("zoom.com")) return "zoom";
  if (u.includes("meet.google.com") || u.includes("google.com/meet")) return "google_meet";
  if (
    u.includes("teams.microsoft.com") ||
    u.includes("teams.live.com") ||
    u.includes("microsoft.com/meet")
  ) {
    return "microsoft_teams";
  }
  if (u.includes("webex.com")) return "webex";
  if (u.startsWith("http://") || u.startsWith("https://")) return "unknown_supported";
  return "unsupported";
}

export function isSupportedMeetingUrl(url: string): boolean {
  const platform = detectMeetingPlatform(url);
  if (platform === "transovo_video") return false;
  return platform !== "unsupported";
}

export function meetingPlatformLabel(platform: MeetingPlatform): string {
  switch (platform) {
    case "zoom":
      return "Zoom";
    case "google_meet":
      return "Google Meet";
    case "microsoft_teams":
      return "Microsoft Teams";
    case "webex":
      return "Webex";
    case "transovo_video":
      return "Transovo Video";
    case "unknown_supported":
      return "Online meeting";
    default:
      return "Unsupported";
  }
}
