export async function resolveSharedPlatformOutboundSender(): Promise<{
  fromE164: string;
  phoneNumberId: string;
} | null> {
  const from = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  const id = process.env.VOICE_OUTBOUND_SMS_PHONE_NUMBER_ID?.trim();
  if (!from || !id) return null;
  return { fromE164: from, phoneNumberId: id };
}
