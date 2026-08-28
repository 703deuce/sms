import "server-only";

import { isMessagingSendAuthorized } from "@/lib/messaging/messaging-authority";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";

export type UnifiedMessagingSendGate = {
  allowed: boolean;
  reason: string | null;
  registrationStatus: string | null;
  /** Telnyx campaign use case — low-volume mixed covers MCTB + campaigns. */
  useCase: "MIXED" | "LOW_VOLUME" | string;
  phoneE164: string | null;
};

async function resolveSendingPhoneE164(workspaceId: string): Promise<string | null> {
  const { resolveMassTextSendingNumber } = await import(
    "@/lib/mass-texting/messaging-registration"
  );
  const sender = await resolveMassTextSendingNumber(workspaceId);
  return sender?.phoneE164 ?? null;
}

/** Sync workspace messagingRegistration from live Telnyx state for the sending number. */
export async function syncWorkspaceMessagingFromTelnyx(
  workspaceId: string,
  phoneE164?: string | null,
): Promise<{ ok: boolean; phoneE164: string | null; reason?: string }> {
  const e164 = phoneE164 ?? (await resolveSendingPhoneE164(workspaceId));
  if (!e164) {
    return { ok: false, phoneE164: null, reason: "no_sending_number" };
  }

  const { getMessagingProviderName } = await import("@/lib/messaging/provider-config");
  if (getMessagingProviderName() !== "telnyx") {
    return { ok: false, phoneE164: e164, reason: "telnyx_not_configured" };
  }

  try {
    const { reconcileTelnyxLocalNumberToWorkspace } = await import(
      "@/lib/messaging/telnyx/reconcile-local-number"
    );
    await reconcileTelnyxLocalNumberToWorkspace({ workspaceId, phoneE164: e164 });

    const { syncMassTextRegistrationFromTelnyx } = await import(
      "@/lib/mass-texting/messaging-registration"
    );
    await syncMassTextRegistrationFromTelnyx(workspaceId).catch(() => undefined);

    return { ok: true, phoneE164: e164 };
  } catch (err) {
    return {
      ok: false,
      phoneE164: e164,
      reason: err instanceof Error ? err.message : "telnyx_sync_failed",
    };
  }
}

/**
 * Single A2P gate for MCTB, Mass Texting, and transactional SMS.
 * One approved low-volume / mixed Telnyx campaign on the number is sufficient.
 */
export async function assertWorkspaceMessagingSendAllowed(
  workspaceId: string,
): Promise<UnifiedMessagingSendGate> {
  const phoneE164 = await resolveSendingPhoneE164(workspaceId);
  await syncWorkspaceMessagingFromTelnyx(workspaceId, phoneE164);

  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) {
    return {
      allowed: false,
      reason: "Messaging registration not started — complete compliance setup",
      registrationStatus: null,
      useCase: "MIXED",
      phoneE164,
    };
  }

  if (reg.paused) {
    return {
      allowed: false,
      reason: "Messaging is paused",
      registrationStatus: reg.overallStatus,
      useCase: String(reg.useCase || "MIXED"),
      phoneE164: reg.phoneE164 ?? phoneE164,
    };
  }

  if (!isMessagingSendAuthorized(reg)) {
    const pending =
      reg.overallStatus === "in_review" ||
      reg.brandStatus === "in_review" ||
      reg.campaignStatus === "in_review";
    return {
      allowed: false,
      reason: pending
        ? "A2P pending on Telnyx — assign an approved 10DLC campaign to this number"
        : "A2P campaign not approved or number not attached",
      registrationStatus: reg.overallStatus,
      useCase: String(reg.useCase || "MIXED"),
      phoneE164: reg.phoneE164 ?? phoneE164,
    };
  }

  return {
    allowed: true,
    reason: null,
    registrationStatus: reg.overallStatus,
    useCase: String(reg.useCase || "MIXED"),
    phoneE164: reg.phoneE164 ?? phoneE164,
  };
}
