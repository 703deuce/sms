/**
 * Factory for the active MessagingProvider.
 */

import { mockAdapter } from "./mock-adapter";
import type { MessagingProvider, SendMessageResult } from "./provider";
import { getMessagingProviderName } from "./provider-config";
import { telnyxProvider } from "./telnyx/provider";
import { twilioProvider } from "./twilio-provider";
import type { NumberSearchResult } from "./types";

const mockProvider: MessagingProvider = {
  name: "mock",
  async sendMessage(_reg, input): Promise<SendMessageResult> {
    const result = await mockAdapter.sendSmsViaMessagingService({
      to: input.to,
      body: input.body,
      messagingServiceSid: "MG_MOCK",
    });
    return { providerMessageId: result.sid, status: result.status, raw: result };
  },
  async searchNumbers(areaCode?: string): Promise<NumberSearchResult[]> {
    return mockAdapter.searchNumbers(areaCode);
  },
  async buyPhoneNumber(_reg, phoneNumber) {
    const bought = await mockAdapter.purchaseNumber("AC_MOCK", phoneNumber);
    return { id: bought.sid, phoneNumber: bought.phoneNumber };
  },
  async releasePhoneNumber() {
    return { ok: true as const };
  },
  async createMessagingProfile(reg) {
    const ms = await mockAdapter.createMessagingService(
      `${reg.legalBusinessName || reg.workspaceId} Messaging`,
    );
    return { id: ms.sid, name: ms.friendlyName };
  },
  async assignNumberToMessagingProfile() {
    return { ok: true as const };
  },
  async createBrand(reg) {
    const brand = await mockAdapter.createBrandRegistration(reg);
    return { id: brand.sid, status: brand.status };
  },
  async createCampaign(reg) {
    const campaign = await mockAdapter.createA2pCampaign(reg);
    return { id: campaign.sid, status: campaign.status };
  },
  async assignCampaignToNumber() {
    return { ok: true as const };
  },
  async getBrandStatus(id) {
    return { id, status: "APPROVED" };
  },
  async getCampaignStatus(id) {
    return { id, status: "VERIFIED" };
  },
  async verifyWebhook() {
    return true;
  },
  parseInboundMessage(payload) {
    const p = (payload || {}) as Record<string, string>;
    return {
      providerMessageId: p.MessageSid || `SM_MOCK_${Date.now()}`,
      from: p.From || "",
      to: p.To || "",
      body: p.Body || "",
      mediaUrls: [],
      raw: payload,
    };
  },
  parseDeliveryStatus(payload) {
    const p = (payload || {}) as Record<string, string>;
    return {
      providerMessageId: p.MessageSid || "",
      providerStatus: p.MessageStatus || "delivered",
      internalStatus: "delivered",
      errorCode: null,
      errorDetail: null,
      raw: payload,
    };
  },
};

export function getMessagingProvider(): MessagingProvider {
  return getMessagingProviderByName(getMessagingProviderName());
}

export function getMessagingProviderByName(name: string): MessagingProvider {
  if (name === "telnyx") return telnyxProvider;
  if (name === "twilio") return twilioProvider;
  return mockProvider;
}

/** Prefer the registration's stored provider over the process-wide env default. */
export function getMessagingProviderForRegistration(reg: {
  messagingProvider?: string | null;
}): MessagingProvider {
  const stored = (reg.messagingProvider || "").trim().toLowerCase();
  if (stored === "telnyx" || stored === "twilio" || stored === "mock") {
    return getMessagingProviderByName(stored);
  }
  return getMessagingProvider();
}
