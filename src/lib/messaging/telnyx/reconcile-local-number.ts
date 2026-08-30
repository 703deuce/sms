/**
 * Reconcile MessagingRegistration + PhoneNumber from live Telnyx provider state.
 * Does not force isMessagingReady — derives it from real brand/campaign/profile/assignment.
 */
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isMessagingReady } from "@/lib/messaging/status";
import type { MessagingRegistration } from "@/lib/domain";
import {
  appendRegistrationEvent,
  ensureRegistrationRow,
  getRegistrationByWorkspace,
  updateRegistration,
} from "@/lib/messaging/store";
import { telnyxRequest } from "./client";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import {
  inventoryTenDlc,
  listPhoneNumberCampaignAssignments,
  listTelnyxPhoneNumbers,
} from "./ten-dlc-ops";
import { getMessagingProvider } from "../get-provider";
import {
  isApprovedBrandStatus,
  isApprovedCampaignStatus,
  pickCampaignStatus,
} from "./status-map";

export type TelnyxLocalNumberProviderSnapshot = {
  phoneE164: string;
  providerNumberId: string;
  phoneStatus: string | null;
  messagingProfileId: string | null;
  messagingCampaignId: string | null;
  assignmentCampaignId: string | null;
  assignmentStatus: string | null;
  brandId: string | null;
  brandStatusRaw: string;
  brandApproved: boolean;
  campaignId: string | null;
  campaignStatusRaw: string;
  campaignApproved: boolean;
  providerReady: boolean;
  providerEvidence: Record<string, unknown>;
};

function mapBrandStatus(raw: string): "approved" | "in_review" | "failed" {
  if (isApprovedBrandStatus(raw)) return "approved";
  if (/reject|fail|denied/i.test(raw)) return "failed";
  return "in_review";
}

function mapCampaignStatus(raw: string): "approved" | "in_review" | "failed" {
  if (isApprovedCampaignStatus(raw)) return "approved";
  if (/reject|fail|denied/i.test(raw)) return "failed";
  return "in_review";
}

/** Query Telnyx for the full messaging authorization picture on one local number. */
export async function fetchTelnyxLocalNumberProviderSnapshot(
  phoneE164: string,
): Promise<TelnyxLocalNumberProviderSnapshot | null> {
  const e164 = normalizeE164(phoneE164);
  const numbers = await listTelnyxPhoneNumbers();
  const row = numbers.find((n) => n.phoneNumber === e164);
  if (!row?.id) return null;

  const [phoneDetail, messagingDetail, assignments] = await Promise.all([
    telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(row.id)}`,
      { method: "GET" },
    ).catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
    telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(row.id)}/messaging`,
      { method: "GET" },
    ).catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
    listPhoneNumberCampaignAssignments(),
  ]);

  const detailData =
    phoneDetail && "data" in phoneDetail && phoneDetail.data
      ? (phoneDetail.data as Record<string, unknown>)
      : {};
  const messagingData =
    messagingDetail && "data" in messagingDetail && messagingDetail.data
      ? (messagingDetail.data as Record<string, unknown>)
      : {};

  const messagingProfileId =
    row.messagingProfileId ||
    (detailData.messaging_profile_id != null ? String(detailData.messaging_profile_id) : null) ||
    (messagingData.messaging_profile_id != null
      ? String(messagingData.messaging_profile_id)
      : null);

  const messagingCampaignId =
    detailData.messaging_campaign_id != null ? String(detailData.messaging_campaign_id) : null;

  const assignment =
    assignments.find((a) => a.phoneNumber === e164) ||
    (messagingCampaignId
      ? { phoneNumber: e164, campaignId: messagingCampaignId, assignmentStatus: "assigned" }
      : null);

  const campaignId = assignment?.campaignId || messagingCampaignId || null;

  let brandId: string | null = null;
  let brandStatusRaw = "unknown";
  let campaignStatusRaw = assignment?.assignmentStatus || "unknown";

  const inventory = await inventoryTenDlc();
  const campaignFromInventory = campaignId
    ? inventory.campaigns.find((c) => c.id === campaignId)
    : null;

  if (campaignFromInventory) {
    campaignStatusRaw = campaignFromInventory.status;
    brandId = campaignFromInventory.brandId;
  }

  if (campaignId) {
    const provider = getMessagingProvider();
    try {
      const c = await provider.getCampaignStatus(campaignId);
      campaignStatusRaw = pickCampaignStatus({
        status: c.status,
        campaignStatus: c.status,
      });
      brandId = brandId || c.brandId || null;
    } catch {
      // keep inventory status
    }
  }

  if (brandId) {
    try {
      const provider = getMessagingProvider();
      const b = await provider.getBrandStatus(brandId);
      brandStatusRaw = b.status;
    } catch {
      const brandFromInventory = inventory.brands.find((b) => b.id === brandId);
      if (brandFromInventory) brandStatusRaw = brandFromInventory.status;
    }
  } else if (inventory.brands.length === 1) {
    brandId = inventory.brands[0]!.id;
    brandStatusRaw = inventory.brands[0]!.status;
  }

  const brandApproved = isApprovedBrandStatus(brandStatusRaw);
  const campaignApproved = isApprovedCampaignStatus(campaignStatusRaw);
  const providerReady = Boolean(
    messagingProfileId &&
      phoneE164 &&
      campaignId &&
      brandApproved &&
      campaignApproved &&
      (messagingCampaignId || assignment?.campaignId),
  );

  return {
    phoneE164: e164,
    providerNumberId: row.id,
    phoneStatus: row.status,
    messagingProfileId,
    messagingCampaignId,
    assignmentCampaignId: assignment?.campaignId || null,
    assignmentStatus: assignment?.assignmentStatus || null,
    brandId,
    brandStatusRaw,
    brandApproved,
    campaignId,
    campaignStatusRaw,
    campaignApproved,
    providerReady,
    providerEvidence: {
      phoneDetail,
      messagingDetail,
      assignment,
      campaignFromInventory,
    },
  };
}

export type ReconcileTelnyxLocalNumberResult = {
  workspaceId: string;
  phoneE164: string;
  snapshot: TelnyxLocalNumberProviderSnapshot;
  dryRun: boolean;
  providerReady: boolean;
  messagingReadyBefore: boolean;
  messagingReadyAfter: boolean;
  registrationId: string | null;
  changes: Record<string, unknown>;
  phoneNumberRowId: string | null;
};

/**
 * Sync workspace MessagingRegistration from live Telnyx state for an owned local number.
 * Creates registration row if missing; never sets ready without provider approval evidence.
 */
export async function reconcileTelnyxLocalNumberToWorkspace(input: {
  workspaceId: string;
  phoneE164: string;
  dryRun?: boolean;
}): Promise<ReconcileTelnyxLocalNumberResult> {
  const phoneE164 = normalizeE164(input.phoneE164);
  const snapshot = await fetchTelnyxLocalNumberProviderSnapshot(phoneE164);
  if (!snapshot) {
    throw new Error(`Telnyx phone number not found for ${phoneE164}`);
  }

  const prisma = getPrisma();
  const before = await getRegistrationByWorkspace(input.workspaceId);
  const messagingReadyBefore = isMessagingReady(before);

  const brandStatus = mapBrandStatus(snapshot.brandStatusRaw);
  const campaignStatus = mapCampaignStatus(snapshot.campaignStatusRaw);
  const ready = snapshot.providerReady;

  const regPatch = {
    messagingProvider: "telnyx" as const,
    messagingProfileId: snapshot.messagingProfileId,
    messagingServiceSid: snapshot.messagingProfileId,
    brandId: snapshot.brandId,
    brandSid: snapshot.brandId,
    campaignId: snapshot.campaignId,
    a2pCampaignSid: snapshot.campaignId,
    brandStatusRaw: snapshot.brandStatusRaw,
    campaignStatusRaw: snapshot.campaignStatusRaw,
    brandStatus,
    campaignStatus,
    phoneE164: snapshot.phoneE164,
    phoneSid: snapshot.providerNumberId,
    phoneNumberId: snapshot.providerNumberId,
    phoneAttached: Boolean(snapshot.messagingProfileId),
    numberStatus: snapshot.messagingProfileId ? ("ready" as const) : ("in_review" as const),
    messagingServiceStatus: snapshot.messagingProfileId ? ("approved" as const) : ("in_review" as const),
    messagingActivationStatus: ready ? "approved" : "campaign_pending",
    overallStatus: ready ? ("ready" as const) : ("in_review" as const),
    messagingEnabled: ready,
    paused: false,
    registrationApprovedAt: ready ? before?.registrationApprovedAt || new Date() : before?.registrationApprovedAt,
    certifiedAt: before?.certifiedAt || (ready ? new Date() : null),
    lastError: ready ? null : `Telnyx not ready: brand=${snapshot.brandStatusRaw} campaign=${snapshot.campaignStatusRaw}`,
    lastAdvancedAt: new Date(),
  };

  const phonePatch = {
    provider: "telnyx",
    providerNumberId: snapshot.providerNumberId,
    messagingService: snapshot.messagingProfileId,
    a2pStatus: ready ? ("APPROVED" as const) : ("PENDING" as const),
    status: "Active",
    settingsJson: telnyxLocalA2pSettings({
      role: "customer_production",
      a2pApproved: ready,
    }),
  };

  let registrationId = before?.id || null;
  if (!input.dryRun) {
    const reg = before || (await ensureRegistrationRow(input.workspaceId));
    registrationId = reg.id;
    await updateRegistration(input.workspaceId, regPatch);
    await prisma.phoneNumber.updateMany({
      where: { workspaceId: input.workspaceId, e164: phoneE164 },
      data: phonePatch,
    });
    await appendRegistrationEvent({
      workspaceId: input.workspaceId,
      registrationId: reg.id,
      eventType: "telnyx_local_number_reconciled",
      message: `${phoneE164} provider sync (ready=${ready})`,
      payload: {
        providerNumberId: snapshot.providerNumberId,
        messagingProfileId: snapshot.messagingProfileId,
        campaignId: snapshot.campaignId,
        brandStatusRaw: snapshot.brandStatusRaw,
        campaignStatusRaw: snapshot.campaignStatusRaw,
        providerReady: ready,
      },
    });
  }

  const after = input.dryRun ? { ...before, ...regPatch } as MessagingRegistration : await getRegistrationByWorkspace(input.workspaceId);
  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: phoneE164 },
    select: { id: true },
  });

  return {
    workspaceId: input.workspaceId,
    phoneE164,
    snapshot,
    dryRun: Boolean(input.dryRun),
    providerReady: ready,
    messagingReadyBefore,
    messagingReadyAfter: isMessagingReady(after),
    registrationId,
    phoneNumberRowId: pn?.id || null,
    changes: { registration: regPatch, phoneNumber: phonePatch },
  };
}
