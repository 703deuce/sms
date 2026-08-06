/**
 * Telnyx 10DLC ops used by compliance UI + post-approval number linking.
 * Assigns an owned number to an approved campaign and marks workspace messaging ready.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import {
  appendRegistrationEvent,
  ensureRegistrationRow,
  getRegistrationByWorkspace,
  updateRegistration,
} from "@/lib/messaging/store";
import { telnyxRequest } from "./client";
import { unwrapTelnyxData } from "../provider-ids";
import {
  isApprovedBrandStatus,
  isApprovedCampaignStatus,
  pickCampaignStatus,
} from "./status-map";

type TelnyxList<T> = { data?: T[]; meta?: { total_pages?: number; page_number?: number } };

async function listAllPages<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await telnyxRequest<TelnyxList<T>>(path, {
      method: "GET",
      query: { ...query, "page[number]": page, "page[size]": 50 },
    });
    const rows = Array.isArray(res?.data) ? res.data : [];
    out.push(...rows);
    const totalPages = Number(res?.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
  }
  return out;
}

export async function listTelnyxBrands() {
  const rows = await listAllPages<Record<string, unknown>>("/10dlc/brand");
  return rows.map((b) => ({
    id: String(b.brandId || b.id || ""),
    name: String(b.displayName || b.companyName || b.entityType || ""),
    status: String(b.identityStatus || b.status || "unknown"),
    approved: isApprovedBrandStatus(String(b.identityStatus || b.status || "")),
  }));
}

export async function listTelnyxCampaigns() {
  // Prefer campaignBuilder; fall back to /10dlc/campaign.
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await listAllPages<Record<string, unknown>>("/10dlc/campaignBuilder");
  } catch {
    rows = await listAllPages<Record<string, unknown>>("/10dlc/campaign");
  }
  return rows.map((c) => {
    const status = pickCampaignStatus({
      status: c.status != null ? String(c.status) : null,
      campaignStatus: c.campaignStatus != null ? String(c.campaignStatus) : null,
    });
    return {
      id: String(c.campaignId || c.id || ""),
      brandId: c.brandId != null ? String(c.brandId) : null,
      name: String(c.usecase || c.useCase || c.description || c.campaignId || c.id || ""),
      status,
      approved: isApprovedCampaignStatus(status),
    };
  });
}

export async function listTelnyxPhoneNumbers() {
  const rows = await listAllPages<Record<string, unknown>>("/phone_numbers");
  return rows.map((n) => ({
    id: String(n.id || ""),
    phoneNumber: String(n.phone_number || ""),
    messagingProfileId: n.messaging_profile_id != null ? String(n.messaging_profile_id) : null,
    status: n.status != null ? String(n.status) : null,
    type: n.phone_number_type != null ? String(n.phone_number_type) : null,
  }));
}

export async function listPhoneNumberCampaignAssignments() {
  const rows = await listAllPages<Record<string, unknown>>("/10dlc/phoneNumberCampaign");
  return rows.map((r) => ({
    phoneNumber: String(r.phoneNumber || r.phone_number || ""),
    campaignId: String(r.campaignId || r.campaign_id || ""),
    assignmentStatus: String(r.assignmentStatus || r.status || ""),
  }));
}

export async function inventoryTenDlc() {
  const [brands, campaigns, phoneNumbers, assignments] = await Promise.all([
    listTelnyxBrands().catch((err) => {
      console.warn("[10dlc] list brands failed", err);
      return [];
    }),
    listTelnyxCampaigns().catch((err) => {
      console.warn("[10dlc] list campaigns failed", err);
      return [];
    }),
    listTelnyxPhoneNumbers().catch((err) => {
      console.warn("[10dlc] list numbers failed", err);
      return [];
    }),
    listPhoneNumberCampaignAssignments().catch((err) => {
      console.warn("[10dlc] list assignments failed", err);
      return [];
    }),
  ]);
  return { brands, campaigns, phoneNumbers, assignments };
}

/**
 * Attach number → messaging profile (if needed), assign to 10DLC campaign,
 * and mark MessagingRegistration ready so sendQuickSms can fire.
 */
export async function assignNumberToCampaignAndReady(input: {
  workspaceId: string;
  phoneE164: string;
  campaignId?: string;
  brandId?: string;
  messagingProfileId?: string;
  providerNumberId?: string;
}) {
  const phoneE164 = normalizeE164(input.phoneE164);
  if (!phoneE164) throw new Error("phoneE164 is required");

  const inventory = await inventoryTenDlc();
  const campaignId =
    (input.campaignId || "").trim() ||
    inventory.campaigns.find((c) => c.approved)?.id ||
    inventory.campaigns[0]?.id ||
    "";
  if (!campaignId) throw new Error("No Telnyx 10DLC campaign found to assign");

  const campaign =
    inventory.campaigns.find((c) => c.id === campaignId) ||
    ({
      id: campaignId,
      brandId: input.brandId || null,
      status: "unknown",
      approved: false,
      name: campaignId,
    } as const);

  const brandId =
    (input.brandId || "").trim() ||
    campaign.brandId ||
    inventory.brands.find((b) => b.approved)?.id ||
    inventory.brands[0]?.id ||
    null;

  const telnyxNumber =
    inventory.phoneNumbers.find((n) => n.phoneNumber === phoneE164) || null;
  const providerNumberId =
    (input.providerNumberId || "").trim() || telnyxNumber?.id || "";
  if (!providerNumberId) {
    throw new Error(`Telnyx phone number id not found for ${phoneE164}`);
  }

  const reg = await ensureRegistrationRow(input.workspaceId);
  const profileId =
    (input.messagingProfileId || "").trim() ||
    reg.messagingProfileId ||
    (reg.messagingServiceSid && !reg.messagingServiceSid.startsWith("MG")
      ? reg.messagingServiceSid
      : null) ||
    telnyxNumber?.messagingProfileId ||
    null;

  const provider = getMessagingProvider();

  // Ensure messaging profile exists / number attached
  let resolvedProfileId = profileId;
  if (!resolvedProfileId) {
    const created = await provider.createMessagingProfile(reg);
    resolvedProfileId = created.id;
  }

  try {
    await provider.assignNumberToMessagingProfile(providerNumberId, resolvedProfileId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already|exist|same/i.test(msg)) {
      // Continue — some numbers are already profile-attached; assign may still work.
      console.warn("[10dlc] messaging profile attach warning", msg);
    }
  }

  try {
    await provider.assignCampaignToNumber(phoneE164, campaignId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already|exist/i.test(msg)) throw err;
  }

  // Brand/campaign status from Telnyx when available
  let brandStatusRaw = "VERIFIED";
  let campaignStatusRaw = campaign.status || "ACTIVE";
  if (brandId) {
    try {
      const b = await provider.getBrandStatus(brandId);
      brandStatusRaw = b.status;
    } catch {
      // keep default
    }
  }
  try {
    const c = await provider.getCampaignStatus(campaignId);
    campaignStatusRaw = c.status;
  } catch {
    // keep listed status
  }

  const brandApproved = isApprovedBrandStatus(brandStatusRaw);
  const campaignApproved = isApprovedCampaignStatus(campaignStatusRaw);
  const ready = Boolean(resolvedProfileId && phoneE164 && brandApproved && campaignApproved);

  const updated = await updateRegistration(input.workspaceId, {
    messagingProvider: "telnyx",
    messagingProfileId: resolvedProfileId,
    messagingServiceSid: resolvedProfileId,
    brandId,
    brandSid: brandId,
    campaignId,
    a2pCampaignSid: campaignId,
    brandStatusRaw,
    campaignStatusRaw,
    brandStatus: brandApproved ? "approved" : "in_review",
    campaignStatus: campaignApproved ? "approved" : "in_review",
    phoneE164,
    phoneSid: providerNumberId,
    phoneNumberId: providerNumberId,
    phoneAttached: true,
    phonePurchasedAt: reg.phonePurchasedAt || new Date(),
    numberStatus: "ready",
    messagingServiceStatus: "approved",
    messagingActivationStatus: ready ? "approved" : "campaign_pending",
    overallStatus: ready ? "ready" : "in_review",
    messagingEnabled: ready,
    registrationApprovedAt: ready
      ? reg.registrationApprovedAt || new Date()
      : reg.registrationApprovedAt,
    lastError: null,
    lastAdvancedAt: new Date(),
  });

  await appendRegistrationEvent({
    workspaceId: input.workspaceId,
    registrationId: updated.id,
    eventType: "telnyx_number_campaign_assigned",
    message: `${phoneE164} → campaign ${campaignId}`,
    payload: {
      phoneE164,
      campaignId,
      brandId,
      messagingProfileId: resolvedProfileId,
      ready,
      brandStatusRaw,
      campaignStatusRaw,
    },
  });

  // Keep PhoneNumber row in sync for UI
  const prisma = getPrisma();
  await prisma.phoneNumber
    .updateMany({
      where: { workspaceId: input.workspaceId, e164: phoneE164 },
      data: {
        a2pStatus: ready ? "Approved" : "Pending",
        messagingService: resolvedProfileId,
        providerNumberId,
        status: "Active",
      },
    })
    .catch(() => undefined);

  return {
    ok: true as const,
    ready,
    phoneE164,
    campaignId,
    brandId,
    messagingProfileId: resolvedProfileId,
    brandStatusRaw,
    campaignStatusRaw,
    registration: updated,
  };
}

export async function sendTenDlcTestSms(input: {
  workspaceId: string;
  to: string;
  body?: string;
  from?: string;
}) {
  const to = normalizeE164(input.to);
  if (!to) throw new Error("to is required");
  const body = (input.body || "This is a test.").trim() || "This is a test.";
  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (!reg?.phoneE164 || !reg.messagingEnabled) {
    throw new Error("Messaging registration is not ready — assign campaign first");
  }
  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  return sendQuickSms({
    workspaceId: input.workspaceId,
    to,
    body,
    from: input.from || reg.phoneE164 || undefined,
    idempotencyKey: `ten-dlc-test:${to}:${Date.now()}`,
  });
}
