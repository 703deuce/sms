/** Capability flags stamped on every workspace number at carrier provision time.
 *  App entitlements may block usage; carrier routing is always dual-channel. */
export const DEFAULT_NUMBER_CAPABILITY_PATCH = {
  smsEnabled: true,
  voiceEnabled: true,
  mctbEnabled: true,
  aiAfterHoursEnabled: false,
} as const;
