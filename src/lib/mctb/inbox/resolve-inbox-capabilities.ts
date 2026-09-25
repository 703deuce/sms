import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import {
  applyConversationComplianceOverrides,
  deriveMctbInboxCapabilitiesFromInputs,
} from "@/lib/mctb/inbox/capabilities-derive";
import { loadMctbSetupPhoneOptionsWithTelnyxSync } from "@/lib/mctb/setup-telnyx-messaging-sync";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import { deriveRequiredActions } from "@/lib/compliance-helpers";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { getPrisma } from "@/lib/db";
import { isMctbConversationProductSource } from "@/lib/mctb/inbox/is-mctb-conversation-record";

import type {
  MctbInboxCapabilities,
  MctbMessagingAuthority,
} from "@/lib/mctb/inbox/capabilities-types";

export type { MctbInboxCapabilities, MctbMessagingAuthority };

export { deriveMctbInboxCapabilitiesFromInputs } from "@/lib/mctb/inbox/capabilities-derive";

async function loadWorkspaceMessagingReady(workspaceId: string): Promise<boolean> {
  const [phoneNumbers, compliance, reg, adminFlags] = await Promise.all([
    loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
    loadAdminMctbTestFlags(workspaceId),
  ]);
  const requiredActions = deriveRequiredActions(compliance.registration, reg);
  return isMctbSetupMessagingReady({
    phoneNumbers,
    requiredActions,
    adminFlags,
  });
}

async function isPlatformSenderReady(): Promise<boolean> {
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform?.phoneNumberId) return false;
  const auth = await isPhoneAuthorizedForOutboundSms(platform.phoneNumberId);
  return auth.allowed;
}

/**
 * Authoritative MCTB inbox / messaging capability resolver (workspace-level).
 * Compliance gates (opt-out) are applied per conversation via `applyConversationComplianceOverrides`.
 */
export async function resolveMctbInboxCapabilities(
  workspaceId: string,
): Promise<MctbInboxCapabilities> {
  const config = await loadMissedCallTextConfig(workspaceId);
  const senderMode = config.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  const paid = await hasActiveMctbPaidEntitlement(workspaceId);
  const workspaceMessagingReady = await loadWorkspaceMessagingReady(workspaceId);
  const platformReady = senderMode === "PLATFORM" ? await isPlatformSenderReady() : false;
  const senderReady =
    senderMode === "PLATFORM" ? platformReady : workspaceMessagingReady;

  const bookingEntitled = await hasMctbAiBookingEntitlement(workspaceId);

  return deriveMctbInboxCapabilitiesFromInputs({
    senderMode,
    paid,
    workspaceMessagingReady,
    platformSenderReady: platformReady,
    bookingEntitled,
    conversationEnabled: Boolean(config.conversationEnabled),
  });
}

export async function resolveMctbInboxCapabilitiesForConversation(input: {
  workspaceId: string;
  conversationId: string;
}): Promise<MctbInboxCapabilities | null> {
  const prisma = getPrisma();
  const conv = await prisma.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    select: {
      productSource: true,
      contact: { select: { status: true, phone: true } },
    },
  });
  if (!conv || !isMctbConversationProductSource(conv.productSource)) return null;

  const base = await resolveMctbInboxCapabilities(input.workspaceId);
  return applyConversationComplianceOverrides(base, conv.contact?.status);
}

/** Server gate for arbitrary inbox SMS body on MCTB threads. */
export async function assertMctbInboxOutboundAllowed(input: {
  workspaceId: string;
  conversationId: string;
  body: string;
  mediaUrls?: string[];
}): Promise<{ ok: true; capabilities: MctbInboxCapabilities } | { ok: false; status: number; error: string }> {
  const caps = await resolveMctbInboxCapabilitiesForConversation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  if (!caps) {
    return { ok: true, capabilities: await resolveMctbInboxCapabilities(input.workspaceId) };
  }

  const hasMedia = Boolean(input.mediaUrls?.length);
  const hasBody = Boolean(input.body?.trim());

  if (!hasBody && !hasMedia) {
    return { ok: false, status: 400, error: "Message body required" };
  }

  if (caps.messagingAuthority === "opted_out") {
    return { ok: false, status: 403, error: "Contact has opted out of SMS." };
  }

  if (!caps.canUseFreeformMessaging) {
    return {
      ok: false,
      status: 403,
      error:
        caps.senderMode === "PLATFORM"
          ? "Custom SMS is not available on the Transovo platform sender. Use recovery automation or connect an approved business number."
          : "Outbound messaging is not available until your text-back sender is ready.",
    };
  }

  return { ok: true, capabilities: caps };
}
