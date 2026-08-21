import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPlatformDemoNumberE164 } from "@/lib/mctb/onboarding/demo";

/** Workspace that owns the shared platform demo toll-free (for SMS routing). */
export async function resolvePlatformDemoOwnerWorkspaceId(): Promise<string | null> {
  const demoE164 = getPlatformDemoNumberE164();
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: demoE164 },
    select: { workspaceId: true },
  });
  return pn?.workspaceId || null;
}

export async function resolvePlatformDemoSmsSender(): Promise<{
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id";
} | null> {
  const demoE164 = getPlatformDemoNumberE164();
  const prisma = getPrisma();

  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: demoE164 },
    select: { id: true, e164: true },
  });

  if (!pn?.e164) return null;
  return { phoneNumberId: pn.id, e164: pn.e164, source: "sms_phone_number_id" };
}

export function normalizeDemoE164(e164: string): string {
  return normalizeE164(e164);
}
