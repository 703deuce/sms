export type MctbPhoneRole =
  | "platform_demo"
  | "platform_mctb_sender"
  | "customer_production"
  | "customer_voice_only";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseMctbPhoneRole(settingsJson: unknown): MctbPhoneRole | null {
  const role = asRecord(settingsJson).mctbRole;
  if (
    role === "platform_demo" ||
    role === "platform_mctb_sender" ||
    role === "customer_production" ||
    role === "customer_voice_only"
  ) {
    return role;
  }
  return null;
}

export function isPlatformMctbSenderPhoneRecord(input: { settingsJson?: unknown }): boolean {
  if (parseMctbPhoneRole(input.settingsJson) === "platform_mctb_sender") {
    return true;
  }
  const settings = asRecord(input.settingsJson);
  return settings.platformMctbSender === true;
}
