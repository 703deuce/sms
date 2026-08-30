/** Capability flags stamped on every workspace number at provision time. */
export const DEFAULT_NUMBER_CAPABILITY_PATCH = {
  smsEnabled: true,
  voiceEnabled: true,
  mctbEnabled: true,
  aiAfterHoursEnabled: false,
} as const;
