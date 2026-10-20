import { getPrisma } from "@/lib/server/db";

/** Production-certified voice SMS sender when env is set. */
export const HP_CERTIFIED_SMS_E164 =
  process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim() || "+15714073615";

export function normalizePhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export async function pickPreferredSmsSendingNumber(workspaceId: string): Promise<string | null> {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { workspaceId, status: "Active" },
    select: { e164: true },
    orderBy: { createdAt: "asc" },
  });
  return row?.e164 ? normalizePhoneE164(row.e164) : null;
}
