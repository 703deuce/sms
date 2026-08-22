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

type TelnyxList<T> = {
  data?: T[];
  records?: T[];
  page?: number;
  totalRecords?: number;
  meta?: { total_pages?: number; page_number?: number };
};

function extractRecords<T>(res: TelnyxList<T> | null | undefined): T[] {
  if (!res) return [];
  if (Array.isArray(res.records)) return res.records;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

/** 10DLC brand/campaign listing uses page + recordsPerPage + `records` (not page[number]/data). */
async function listTenDlcPages<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await telnyxRequest<TelnyxList<T>>(path, {
      method: "GET",
      query: { ...query, page, recordsPerPage: 100 },
    });
    const rows = extractRecords(res);
    out.push(...rows);
    const total = Number(res?.totalRecords || 0);
    if (rows.length === 0) break;
    if (total > 0 && out.length >= total) break;
    if (rows.length < 100) break;
  }
  return out;
}

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
    const rows = extractRecords(res);
    out.push(...rows);
    const totalPages = Number(res?.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
  }
  return out;
}

export async function listTelnyxBrands() {
  const rows = await listTenDlcPages<Record<string, unknown>>("/10dlc/brand");
  return rows.map((b) => ({
    id: String(b.brandId || b.id || ""),
    name: String(b.displayName || b.companyName || b.entityType || ""),
    status: String(b.identityStatus || b.status || "unknown"),
    approved: isApprovedBrandStatus(String(b.identityStatus || b.status || "")),
  }));
}

export async function listTelnyxCampaigns(brandId?: string) {
  // Campaign list requires brandId. If omitted, list per known brand.
  const brandIds = brandId
    ? [brandId]
    : (await listTelnyxBrands()).map((b) => b.id).filter(Boolean);

  const out: Array<{
    id: string;
    brandId: string | null;
    name: string;
    status: string;
    approved: boolean;
  }> = [];

  for (const bid of brandIds) {
    try {
      const rows = await listTenDlcPages<Record<string, unknown>>("/10dlc/campaign", {
        brandId: bid,
      });
      for (const c of rows) {
        const status = pickCampaignStatus({
          status: c.status != null ? String(c.status) : null,
          campaignStatus: c.campaignStatus != null ? String(c.campaignStatus) : null,
        });
        out.push({
          id: String(c.campaignId || c.id || ""),
          brandId: bid,
          name: String(c.usecase || c.useCase || c.description || c.campaignId || c.id || ""),
          status,
          approved: isApprovedCampaignStatus(status),
        });
      }
    } catch (err) {
      console.warn("[10dlc] list campaigns for brand failed", bid, err);
    }
  }

  // Also try campaignBuilder without brand filter when brand list empty.
  if (!out.length) {
    try {
      const rows = await listTenDlcPages<Record<string, unknown>>("/10dlc/campaignBuilder");
      for (const c of rows) {
        const status = pickCampaignStatus({
          status: c.status != null ? String(c.status) : null,
          campaignStatus: c.campaignStatus != null ? String(c.campaignStatus) : null,
        });
        out.push({
          id: String(c.campaignId || c.id || ""),
          brandId: c.brandId != null ? String(c.brandId) : null,
          name: String(c.usecase || c.useCase || c.description || c.campaignId || c.id || ""),
          status,
          approved: isApprovedCampaignStatus(status),
        });
      }
    } catch (err) {
      console.warn("[10dlc] campaignBuilder list failed", err);
    }
  }

  return out;
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
  const rows = await listTenDlcPages<Record<string, unknown>>("/10dlc/phone_number_campaigns");
  return rows.map((r) => ({
    phoneNumber: String(r.phoneNumber || r.phone_number || ""),
    campaignId: String(r.campaignId || r.campaign_id || ""),
    assignmentStatus: String(r.assignmentStatus || r.status || ""),
  }));
}

export async function inventoryTenDlc() {
  const brands = await listTelnyxBrands().catch((err) => {
    console.warn("[10dlc] list brands failed", err);
    return [] as Awaited<ReturnType<typeof listTelnyxBrands>>;
  });
  const [campaigns, phoneNumbers, assignments] = await Promise.all([
    listTelnyxCampaigns().catch((err) => {
      console.warn("[10dlc] list campaigns failed", err);
      return [] as Awaited<ReturnType<typeof listTelnyxCampaigns>>;
    }),
    listTelnyxPhoneNumbers().catch((err) => {
      console.warn("[10dlc] list numbers failed", err);
      return [] as Awaited<ReturnType<typeof listTelnyxPhoneNumbers>>;
    }),
    listPhoneNumberCampaignAssignments().catch((err) => {
      console.warn("[10dlc] list assignments failed", err);
      return [] as Awaited<ReturnType<typeof listPhoneNumberCampaignAssignments>>;
    }),
  ]);
  return { brands, campaigns, phoneNumbers, assignments };
}

/** Pull local DB + Telnyx provider status for a sent message. */
export async function diagnoseOutboundMessage(input: {
  workspaceId: string;
  messageId?: string;
  providerMessageId?: string;
  to?: string;
}) {
  const prisma = getPrisma();
  const to = input.to ? normalizeE164(input.to) : "";

  const local =
    (input.messageId
      ? await prisma.message.findFirst({
          where: { id: input.messageId, workspaceId: input.workspaceId },
        })
      : null) ||
    (input.providerMessageId
      ? await prisma.message.findFirst({
          where: {
            workspaceId: input.workspaceId,
            providerId: input.providerMessageId,
          },
        })
      : null) ||
    (to
      ? await prisma.message.findFirst({
          where: { workspaceId: input.workspaceId, to },
          orderBy: { createdAt: "desc" },
        })
      : null);

  const recent = await prisma.message.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      to: true,
      from: true,
      body: true,
      status: true,
      providerId: true,
      createdAt: true,
    },
  });

  const providerId = input.providerMessageId || local?.providerId || "";
  let telnyx: unknown = null;
  let telnyxError: string | null = null;
  if (providerId && !providerId.startsWith("idem:") && !providerId.startsWith("pending:")) {
    try {
      telnyx = await telnyxRequest(`/messages/${encodeURIComponent(providerId)}`, {
        method: "GET",
      });
    } catch (err) {
      telnyxError = err instanceof Error ? err.message : String(err);
    }
  }

  let fromMessaging: unknown = null;
  const from = local?.from && local.from.startsWith("+") ? local.from : "+15714073615";
  try {
    const nums = await listTelnyxPhoneNumbers();
    const match = nums.find((n) => n.phoneNumber === from);
    if (match?.id) {
      const [detail, messaging] = await Promise.all([
        telnyxRequest(`/phone_numbers/${encodeURIComponent(match.id)}`, {
          method: "GET",
        }).catch((e) => ({ error: String(e) })),
        telnyxRequest(`/phone_numbers/${encodeURIComponent(match.id)}/messaging`, {
          method: "GET",
        }).catch((e) => ({ error: String(e) })),
      ]);
      fromMessaging = { phoneNumberId: match.id, e164: from, detail, messaging };
    }
  } catch (err) {
    fromMessaging = { error: err instanceof Error ? err.message : String(err) };
  }

  const assignment =
    (await listPhoneNumberCampaignAssignments().catch(() => [])).find(
      (a) => a.phoneNumber === from,
    ) || null;

  let assignmentDetail: unknown = null;
  try {
    assignmentDetail = await telnyxRequest(
      `/10dlc/phone_number_campaigns/${encodeURIComponent(from)}`,
      { method: "GET" },
    );
  } catch (err) {
    assignmentDetail = { error: err instanceof Error ? err.message : String(err) };
  }

  // Campaign details for use-case mismatch clues (e.g. 2FA rejecting free text).
  let campaignDetail: unknown = null;
  if (assignment?.campaignId) {
    try {
      campaignDetail = await telnyxRequest(
        `/10dlc/campaign/${encodeURIComponent(assignment.campaignId)}`,
        { method: "GET" },
      );
    } catch (err) {
      campaignDetail = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    local,
    recent,
    telnyx,
    telnyxError,
    fromMessaging,
    assignment,
    assignmentDetail,
    campaignDetail,
  };
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
    // Already assigned → overwrite via PUT so messaging_campaign_id sticks.
    if (/already|exist/i.test(msg)) {
      try {
        await telnyxRequest(
          `/10dlc/phone_number_campaigns/${encodeURIComponent(phoneE164)}`,
          {
            method: "PUT",
            body: { phoneNumber: phoneE164, campaignId },
          },
        );
      } catch (putErr) {
        const putMsg = putErr instanceof Error ? putErr.message : String(putErr);
        if (!/already|exist/i.test(putMsg)) throw putErr;
      }
    } else {
      throw err;
    }
  }

  // Verify Telnyx now shows the campaign on the number (carriers check this).
  let messagingCampaignId: string | null = null;
  try {
    const detail = await telnyxRequest<{
      data?: { messaging_campaign_id?: string | null };
    }>(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, { method: "GET" });
    messagingCampaignId = detail?.data?.messaging_campaign_id
      ? String(detail.data.messaging_campaign_id)
      : null;
  } catch {
    // non-fatal
  }
  if (!messagingCampaignId) {
    // Force PUT even when POST appeared to succeed but DID still has null campaign.
    try {
      await telnyxRequest(
        `/10dlc/phone_number_campaigns/${encodeURIComponent(phoneE164)}`,
        {
          method: "PUT",
          body: { phoneNumber: phoneE164, campaignId },
        },
      );
      const detail2 = await telnyxRequest<{
        data?: { messaging_campaign_id?: string | null };
      }>(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, { method: "GET" });
      messagingCampaignId = detail2?.data?.messaging_campaign_id
        ? String(detail2.data.messaging_campaign_id)
        : null;
    } catch (err) {
      console.warn(
        "[10dlc] campaign PUT/verify warning",
        err instanceof Error ? err.message : err,
      );
    }
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
        a2pStatus: ready ? "APPROVED" : "PENDING",
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
    messagingCampaignId,
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
  // Keep test bodies campaign-safe: no tracking/review links appended.
  // (2FA campaigns often set embeddedLink=false and reject free-form marketing text.)
  const body = (input.body || "This is a test.").trim() || "This is a test.";
  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (!reg?.phoneE164 || !reg.messagingEnabled) {
    throw new Error("Messaging registration is not ready — assign campaign first");
  }

  // Bypass sendQuickSms template/tracking so we can send a clean compliance test.
  const { sendViaRegistration } = await import("@/lib/messaging/registration-processor");
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const from = input.from || reg.phoneE164;
  const pending = await prisma.message.create({
    data: {
      workspaceId: input.workspaceId,
      to,
      from,
      body,
      status: "sending",
      providerId: `pending:ten-dlc-test:${Date.now()}`,
      idempotencyKey: `ten-dlc-test-clean:${to}:${Date.now()}`,
    },
  });
  try {
    const result = await sendViaRegistration(input.workspaceId, to, body, undefined, from);
    await prisma.message.update({
      where: { id: pending.id },
      data: { status: result.status || "sent", providerId: result.sid },
    });
    return {
      sid: result.sid,
      status: result.status,
      to,
      messagingServiceSid: result.messagingServiceSid,
      messageId: pending.id,
    };
  } catch (err) {
    await prisma.message.update({
      where: { id: pending.id },
      data: { status: "failed" },
    });
    throw err;
  }
}
