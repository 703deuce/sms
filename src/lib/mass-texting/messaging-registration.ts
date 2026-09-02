import "server-only";

import { getPrisma } from "@/lib/db";

export type MessagingProductUseCase = "MCTB_CUSTOMER_CARE" | "MASS_TEXT_MARKETING";

export async function getMessagingProductRegistration(
  workspaceId: string,
  productUseCase: MessagingProductUseCase,
) {
  const prisma = getPrisma();
  try {
    return await prisma.messagingProductRegistration.findUnique({
      where: {
        workspaceId_productUseCase: { workspaceId, productUseCase },
      },
    });
  } catch {
    return null;
  }
}

export async function ensureMessagingProductRegistration(
  workspaceId: string,
  productUseCase: MessagingProductUseCase,
) {
  const prisma = getPrisma();
  try {
    return await prisma.messagingProductRegistration.upsert({
      where: {
        workspaceId_productUseCase: { workspaceId, productUseCase },
      },
      create: {
        workspaceId,
        productUseCase,
        overallStatus: "not_started",
      },
      update: {},
    });
  } catch {
    return null;
  }
}

/** Mass Text sends use the same workspace A2P registration as MCTB (low-volume mixed). */
export async function resolveMassTextSendingNumber(
  workspaceId: string,
  preferredNumberId?: string | null,
) {
  const { pickPreferredSmsSendingNumber, isApprovedMessagingStatus } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  const { isPhoneMessagingApproved } = await import(
    "@/lib/messaging/compliance/messaging-compliance"
  );

  const reg = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");

  if (preferredNumberId) {
    const prisma = getPrisma();
    const preferred = await prisma.phoneNumber.findFirst({
      where: { id: preferredNumberId, workspaceId, status: "Active" },
    });
    if (preferred?.e164) {
      return {
        phoneE164: preferred.e164,
        phoneNumberId: preferred.id,
        registration: reg,
      };
    }
  }
  if (reg?.phoneE164 && (reg.messagingEnabled || isApprovedMessagingStatus(reg.overallStatus))) {
    return {
      phoneE164: reg.phoneE164,
      phoneNumberId: reg.phoneNumberId,
      registration: reg,
    };
  }

  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: {
      workspaceId,
      status: "Active",
    },
    orderBy: { e164: "asc" },
  });

  const tagged = numbers.filter((number: (typeof numbers)[number]) => {
    const settings =
      number.settingsJson && typeof number.settingsJson === "object"
        ? (number.settingsJson as Record<string, unknown>)
        : {};
    const massTextRole = String(settings.massTextRole || settings.mass_text_role || "").toLowerCase();
    return massTextRole && massTextRole !== "none";
  });
  if (tagged.length) {
    const preferredTagged = pickPreferredSmsSendingNumber(tagged);
    if (preferredTagged) {
      return {
        phoneE164: preferredTagged.e164,
        phoneNumberId: preferredTagged.id,
        registration: reg,
      };
    }
  }

  const approvedLocal = numbers.filter(
    (number: (typeof numbers)[number]) =>
      isPhoneMessagingApproved(number) && !/toll/i.test(String(number.type || "")),
  );
  const preferred = pickPreferredSmsSendingNumber(approvedLocal.length ? approvedLocal : numbers);
  if (preferred && isPhoneMessagingApproved(preferred)) {
    return {
      phoneE164: preferred.e164,
      phoneNumberId: preferred.id,
      registration: reg,
    };
  }

  return preferred
    ? {
        phoneE164: preferred.e164,
        phoneNumberId: preferred.id,
        registration: reg,
      }
    : null;
}

export async function onMassTextMessagingReady(workspaceId: string) {
  const { activateMassTextingTrial } = await import("@/lib/mass-texting/trial-lifecycle");
  await activateMassTextingTrial(workspaceId);
}

/** Sync Mass Texting product registration when Telnyx trial/production campaign becomes ready. */
export async function reconcileMassTextMessagingRegistration(input: {
  workspaceId: string;
  overallStatus: string;
  messagingEnabled: boolean;
  phoneAttached: boolean;
  phoneE164?: string | null;
  phoneNumberId?: string | null;
  brandId?: string | null;
  campaignId?: string | null;
  isTrialCampaign?: boolean;
}) {
  const prisma = getPrisma();
  const reg = await ensureMessagingProductRegistration(
    input.workspaceId,
    "MASS_TEXT_MARKETING",
  );
  if (!reg) return null;

  const updated = await prisma.messagingProductRegistration.update({
    where: { id: reg.id },
    data: {
      overallStatus: input.overallStatus,
      messagingEnabled: input.messagingEnabled,
      phoneAttached: input.phoneAttached,
      phoneE164: input.phoneE164 ?? reg.phoneE164,
      phoneNumberId: input.phoneNumberId ?? reg.phoneNumberId,
      brandId: input.brandId ?? reg.brandId,
      campaignId: input.campaignId ?? reg.campaignId,
      registrationApprovedAt:
        input.messagingEnabled && input.phoneAttached ? new Date() : reg.registrationApprovedAt,
    },
  });

  if (input.messagingEnabled && input.phoneAttached) {
    const approved =
      input.overallStatus === "approved" ||
      input.overallStatus === "certified" ||
      input.overallStatus === "ready";
    if (approved) {
      await onMassTextMessagingReady(input.workspaceId);
    }
  }

  return updated;
}

export type MassTextTelnyxSyncResult = {
  ok: boolean;
  providerReady: boolean;
  phoneE164: string | null;
  reason?: string;
  brandStatusRaw?: string;
  campaignStatusRaw?: string;
};

/**
 * Sync MASS_TEXT_MARKETING registration + workspace phone from live Telnyx state.
 * Telnyx brand/campaign/number assignment is the source of truth — never guess approved locally.
 */
export async function syncMassTextRegistrationFromTelnyx(
  workspaceId: string,
): Promise<MassTextTelnyxSyncResult> {
  const sender = await resolveMassTextSendingNumber(workspaceId);
  if (!sender?.phoneE164) {
    return { ok: false, providerReady: false, phoneE164: null, reason: "no_sending_number" };
  }

  const { getMessagingProviderName } = await import("@/lib/messaging/provider-config");
  if (getMessagingProviderName() !== "telnyx") {
    return {
      ok: false,
      providerReady: false,
      phoneE164: sender.phoneE164,
      reason: "telnyx_not_configured",
    };
  }

  try {
    const { fetchTelnyxLocalNumberProviderSnapshot, reconcileTelnyxLocalNumberToWorkspace } =
      await import("@/lib/messaging/telnyx/reconcile-local-number");
    const snapshot = await fetchTelnyxLocalNumberProviderSnapshot(sender.phoneE164);
    if (!snapshot) {
      return {
        ok: false,
        providerReady: false,
        phoneE164: sender.phoneE164,
        reason: "telnyx_number_not_found",
      };
    }

    await reconcileTelnyxLocalNumberToWorkspace({
      workspaceId,
      phoneE164: sender.phoneE164,
    }).catch((err) => {
      console.warn("[mass-text] workspace Telnyx reconcile failed", err);
    });

    const overallStatus = snapshot.providerReady ? "ready" : "in_review";
    await reconcileMassTextMessagingRegistration({
      workspaceId,
      overallStatus,
      messagingEnabled: snapshot.providerReady,
      phoneAttached: Boolean(snapshot.messagingProfileId),
      phoneE164: snapshot.phoneE164,
      phoneNumberId: sender.phoneNumberId,
      brandId: snapshot.brandId,
      campaignId: snapshot.campaignId,
    });

    const prisma = getPrisma();
    await prisma.phoneNumber
      .updateMany({
        where: { workspaceId, e164: snapshot.phoneE164 },
        data: {
          a2pStatus: snapshot.providerReady ? "APPROVED" : "PENDING",
          providerNumberId: snapshot.providerNumberId,
          messagingService: snapshot.messagingProfileId,
        },
      })
      .catch(() => undefined);

    return {
      ok: true,
      providerReady: snapshot.providerReady,
      phoneE164: snapshot.phoneE164,
      brandStatusRaw: snapshot.brandStatusRaw,
      campaignStatusRaw: snapshot.campaignStatusRaw,
      reason: snapshot.providerReady
        ? undefined
        : `Telnyx pending: brand=${snapshot.brandStatusRaw} campaign=${snapshot.campaignStatusRaw}`,
    };
  } catch (err) {
    return {
      ok: false,
      providerReady: false,
      phoneE164: sender.phoneE164,
      reason: err instanceof Error ? err.message : "telnyx_sync_failed",
    };
  }
}
