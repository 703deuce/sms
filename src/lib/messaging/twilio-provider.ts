/**
 * Twilio MessagingProvider adapter wrapping the existing twilioAdapter.
 * Kept for rollback until Telnyx is fully verified.
 */

import { twilioAdapter } from "./twilio-adapter";
import type {
  BrandResult,
  CampaignResult,
  MessagingProvider,
  MessagingProfileResult,
  ParsedDeliveryStatus,
  ParsedInboundMessage,
  PurchasedNumber,
  SendMessageResult,
  WebhookVerificationInput,
} from "./provider";
import type { NumberSearchResult } from "./types";
import { validateTwilioSignature } from "./twilio-client";
import { getTwilioParentCredentials, getWebhookUrls } from "./twilio-config";

function mapStatus(status: string): ParsedDeliveryStatus["internalStatus"] {
  const s = status.toLowerCase();
  if (s === "queued" || s === "accepted") return "queued";
  if (s === "sent" || s === "sending") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "failed") return "failed";
  if (s === "undelivered") return "undelivered";
  return "unknown";
}

export const twilioProvider: MessagingProvider = {
  name: "twilio",

  async sendMessage(reg, input): Promise<SendMessageResult> {
    const result = await twilioAdapter.sendSmsViaMessagingService(reg, {
      to: input.to,
      body: input.body,
      from: input.from,
      messagingServiceSid: input.messagingServiceSid || reg.messagingServiceSid,
    });
    return {
      providerMessageId: result.sid,
      status: result.status,
      raw: result,
    };
  },

  async searchNumbers(areaCode?: string): Promise<NumberSearchResult[]> {
    return twilioAdapter.searchNumbers(areaCode);
  },

  async buyPhoneNumber(reg, phoneNumber): Promise<PurchasedNumber> {
    const bought = await twilioAdapter.purchaseNumber(reg, phoneNumber);
    return { id: bought.sid, phoneNumber: bought.phoneNumber };
  },

  async releasePhoneNumber(reg, phoneNumberId) {
    await twilioAdapter.releaseNumber(reg, phoneNumberId);
    return { ok: true as const };
  },

  async createMessagingProfile(reg): Promise<MessagingProfileResult> {
    const service = await twilioAdapter.createMessagingService(
      reg,
      `${reg.legalBusinessName || reg.workspaceId} Messaging`,
    );
    return { id: service.sid, name: service.friendlyName || "Messaging Service" };
  },

  async assignNumberToMessagingProfile() {
    return { ok: true as const };
  },

  async createBrand(reg): Promise<BrandResult> {
    const brand = await twilioAdapter.createBrandRegistration(reg);
    return { id: brand.sid, status: brand.status };
  },

  async createCampaign(reg): Promise<CampaignResult> {
    const campaign = await twilioAdapter.createA2pCampaign(reg);
    return { id: campaign.sid, status: campaign.status };
  },

  async assignCampaignToNumber() {
    return { ok: true as const };
  },

  async getBrandStatus(regOrId: string): Promise<BrandResult> {
    return { id: regOrId, status: "unknown" };
  },

  async getCampaignStatus(regOrId: string): Promise<CampaignResult> {
    return { id: regOrId, status: "unknown" };
  },

  async verifyWebhook(input: WebhookVerificationInput) {
    const { authToken } = getTwilioParentCredentials();
    if (!authToken || !input.signature) return false;
    const url = getWebhookUrls().inbound;
    const params: Record<string, string> = {};
    if (typeof input.payload === "string") {
      const search = new URLSearchParams(input.payload);
      search.forEach((v, k) => {
        params[k] = v;
      });
    }
    return validateTwilioSignature(authToken, input.signature, url, params);
  },

  parseInboundMessage(payload: unknown): ParsedInboundMessage {
    const p = (payload || {}) as Record<string, string>;
    return {
      providerMessageId: p.MessageSid || "",
      from: p.From || "",
      to: p.To || "",
      body: p.Body || "",
      mediaUrls: [],
      raw: payload,
    };
  },

  parseDeliveryStatus(payload: unknown): ParsedDeliveryStatus {
    const p = (payload || {}) as Record<string, string>;
    return {
      providerMessageId: p.MessageSid || "",
      providerStatus: p.MessageStatus || p.SmsStatus || "unknown",
      internalStatus: mapStatus(p.MessageStatus || p.SmsStatus || ""),
      errorCode: p.ErrorCode || null,
      errorDetail: p.ErrorMessage || null,
      raw: payload,
    };
  },
};
