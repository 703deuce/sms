/** Wizard / UI select value — not a Prisma `phoneNumber.id`. */
export const VOICE_OUTBOUND_SMS_PLATFORM_SELECT_VALUE = "__transovo_platform_sender__";

export function isPlatformOutboundSmsMode(mode: string | undefined | null): boolean {
  return mode === "platform";
}
