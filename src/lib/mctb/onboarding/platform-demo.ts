import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getPlatformDemoNumberE164 } from "@/lib/mctb/onboarding/demo";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_FLOW_NAME } from "@/lib/mctb/consent-prompt/types";

/** Workspace that owns the shared platform demo Telnyx line (voice + A2P SMS routing). */
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

async function loadPlatformDemoPhoneRecord(ownerWorkspaceId: string) {
  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164, workspaceId: ownerWorkspaceId },
    select: { id: true, providerNumberId: true, e164: true },
  });
}

async function pauseLegacyPlatformDemoSmartRouting(
  ownerWorkspaceId: string,
  phoneNumberId: string,
): Promise<void> {
  const prisma = getPrisma();
  const flows = await prisma.smartRoutingFlow.findMany({
    where: {
      workspaceId: ownerWorkspaceId,
      assignedPhoneNumberId: phoneNumberId,
      status: "active",
    },
    select: { id: true },
  });
  if (!flows.length) return;
  const { pauseFlow } = await import("@/lib/smart-routing/flow-service");
  for (const flow of flows) {
    await pauseFlow(ownerWorkspaceId, flow.id).catch(() => undefined);
  }
}

/**
 * Wire the shared Try It platform demo DID to MCTB TeXML ingress (mctb-entry).
 * Same voice engine as production — only the entry point differs (direct dial vs forward).
 */
export async function ensurePlatformDemoSipIngress(): Promise<{
  ok: boolean;
  ownerWorkspaceId: string;
  phoneNumberId: string;
  providerNumberId: string | null;
  e164: string;
  actions: string[];
  error?: string;
}> {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) throw new Error("Platform demo owner workspace not found");

  const pn = await loadPlatformDemoPhoneRecord(ownerId);
  if (!pn?.id) {
    throw new Error(`Platform demo phone ${MCTB_PLATFORM_DEMO_E164} not found`);
  }

  const { provisionMctbTelnyxSipIngress } = await import(
    "@/lib/mctb/provisioning/telnyx-sip-ingress"
  );
  const provision = await provisionMctbTelnyxSipIngress({
    workspaceId: ownerId,
    phoneNumberId: pn.id,
    mctbRole: "platform_demo",
    delaySeconds: 0,
  });

  await getPrisma().voiceAgent.updateMany({
    where: { workspaceId: ownerId, phoneNumberId: pn.id, status: "ACTIVE" },
    data: { phoneNumberId: null },
  });
  await pauseLegacyPlatformDemoSmartRouting(ownerId, pn.id);

  return {
    ok: provision.ok,
    ownerWorkspaceId: ownerId,
    phoneNumberId: pn.id,
    providerNumberId: pn.providerNumberId,
    e164: pn.e164 || MCTB_PLATFORM_DEMO_E164,
    actions: provision.actions,
    error: provision.error,
  };
}

/**
 * @deprecated Name kept for cert scripts — routes platform demo to SIP/LiveKit, not TeXML.
 */
export async function preparePlatformDemoNumberForSmartRouting(): Promise<{
  ownerWorkspaceId: string;
  phoneNumberId: string;
  providerNumberId: string;
}> {
  const result = await ensurePlatformDemoSipIngress();
  if (!result.ok) {
    throw new Error(result.error || "platform_demo_sip_ingress_failed");
  }
  if (!result.providerNumberId) {
    throw new Error(`Platform demo phone ${MCTB_PLATFORM_DEMO_E164} missing Telnyx id`);
  }
  return {
    ownerWorkspaceId: result.ownerWorkspaceId,
    phoneNumberId: result.phoneNumberId,
    providerNumberId: result.providerNumberId,
  };
}

/**
 * Ensure Try It uses the same MCTB TeXML handler as production (mctb-entry).
 * Consent mode (Press 1 vs existing) is resolved per-workspace at SIP session time.
 */
export async function syncPlatformDemoConsentRuntime(mode: MctbConsentMode): Promise<{
  mode: MctbConsentMode;
  action:
    | "sip_ingress_ready"
    | "sip_ingress_failed"
    | "paused_verified_consent"
    | "activated_verified_consent"
    | "no_flow";
}> {
  const result = await ensurePlatformDemoSipIngress();
  if (!result.ok) {
    return { mode, action: "sip_ingress_failed" };
  }

  const legacyFlow = await getPrisma().smartRoutingFlow.findFirst({
    where: {
      workspaceId: result.ownerWorkspaceId,
      assignedPhoneNumberId: result.phoneNumberId,
      name: MCTB_CONSENT_FLOW_NAME,
    },
    select: { id: true, status: true },
  });

  if (legacyFlow?.status === "active") {
    const { pauseFlow } = await import("@/lib/smart-routing/flow-service");
    await pauseFlow(result.ownerWorkspaceId, legacyFlow.id).catch(() => undefined);
    return { mode, action: "paused_verified_consent" };
  }

  return {
    mode,
    action: legacyFlow ? "paused_verified_consent" : "sip_ingress_ready",
  };
}
