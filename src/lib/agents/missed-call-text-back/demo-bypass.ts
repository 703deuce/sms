import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import {
  getPlatformDemoNumberE164,
  isPlatformDemoNumber,
  isDemoModeForWorkspace,
} from "@/lib/mctb/onboarding/demo";

export type DemoBypassContext = {
  isDemo: boolean;
  workspaceId: string;
  callerE164: string;
  businessE164: string;
};

export async function resolveDemoBypassContext(input: {
  workspaceId: string;
  callerE164: string;
  businessE164: string;
}): Promise<DemoBypassContext> {
  if (!isPlatformDemoNumber(input.businessE164)) {
    return { isDemo: false, ...input };
  }

  const state = await loadMctbOnboardingState(input.workspaceId);
  const isDemo = isDemoModeForWorkspace(
    input.workspaceId,
    input.businessE164,
    input.callerE164,
    state.demoSession,
  );
  return { isDemo, ...input };
}

export async function resolveOnboardingWorkspaceForDemoCall(
  callerE164: string,
  businessE164: string,
): Promise<string | null> {
  if (!isPlatformDemoNumber(businessE164)) return null;
  const { resolveDemoWorkspaceForCaller } = await import("@/lib/mctb/onboarding/demo");
  const match = await resolveDemoWorkspaceForCaller(callerE164);
  return match?.workspaceId || null;
}

export function getDemoNumberOrNull(): string | null {
  return getPlatformDemoNumberE164();
}

export async function resolvePlatformDemoSmsSender(): Promise<{
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id";
} | null> {
  const demoE164 = getPlatformDemoNumberE164();
  if (!demoE164) return null;

  const prisma = (await import("@/lib/db")).getPrisma();
  const workspaceId = process.env.PLATFORM_MCTB_DEMO_WORKSPACE_ID?.trim();

  const pn = workspaceId
    ? await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164: demoE164 },
        select: { id: true, e164: true },
      })
    : await prisma.phoneNumber.findFirst({
        where: { e164: demoE164 },
        select: { id: true, e164: true },
      });

  if (!pn?.e164) return null;
  return { phoneNumberId: pn.id, e164: pn.e164, source: "sms_phone_number_id" };
}

export function normalizeDemoE164(e164: string): string {
  return normalizeE164(e164);
}
