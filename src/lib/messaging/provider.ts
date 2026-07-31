/**
 * Provider-neutral messaging interface.
 * App code should depend on this, not Twilio or Telnyx SDKs directly.
 */

import type { MessagingRegistration } from "@/lib/domain";
import type { NumberSearchOptions, NumberSearchResult } from "./types";

export type MessagingProviderName = "mock" | "twilio" | "telnyx";

export type SendMessageInput = {
  to: string;
  body: string;
  /** E.164 From number when provider requires From instead of profile/service SID */
  from?: string;
  messagingProfileId?: string | null;
  messagingServiceSid?: string | null;
  statusCallbackUrl?: string;
  mediaUrls?: string[];
};

export type SendMessageResult = {
  providerMessageId: string;
  status: string;
  raw?: unknown;
};

export type PurchasedNumber = {
  id: string;
  phoneNumber: string;
  /** Telnyx number-order id when purchase is async */
  orderId?: string;
  pending?: boolean;
};

export type MessagingProfileResult = {
  id: string;
  name: string;
};

export type BrandResult = {
  id: string;
  status: string;
};

export type CampaignResult = {
  id: string;
  status: string;
};

export type WebhookVerificationInput = {
  payload: string | Buffer;
  signature: string | null;
  timestamp?: string | null;
  headers?: Headers | Record<string, string | null>;
};

export type ParsedInboundMessage = {
  providerMessageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  raw: unknown;
};

export type ParsedDeliveryStatus = {
  providerMessageId: string;
  providerStatus: string;
  internalStatus: "queued" | "sent" | "delivered" | "failed" | "undelivered" | "expired" | "unknown";
  errorCode?: string | null;
  errorDetail?: string | null;
  raw: unknown;
};

export interface MessagingProvider {
  readonly name: MessagingProviderName;

  sendMessage(reg: MessagingRegistration, input: SendMessageInput): Promise<SendMessageResult>;
  sendMms?(reg: MessagingRegistration, input: SendMessageInput): Promise<SendMessageResult>;

  searchNumbers(areaCode?: string, options?: NumberSearchOptions): Promise<NumberSearchResult[]>;
  buyPhoneNumber(reg: MessagingRegistration, phoneNumber: string): Promise<PurchasedNumber>;
  releasePhoneNumber(reg: MessagingRegistration, phoneNumberId: string): Promise<{ ok: true }>;

  createMessagingProfile(reg: MessagingRegistration): Promise<MessagingProfileResult>;
  assignNumberToMessagingProfile(
    phoneNumberId: string,
    messagingProfileId: string,
  ): Promise<{ ok: true }>;

  createBrand(reg: MessagingRegistration): Promise<BrandResult>;
  createCampaign(reg: MessagingRegistration): Promise<CampaignResult>;
  assignCampaignToNumber(phoneNumber: string, campaignId: string): Promise<{ ok: true }>;
  getBrandStatus(brandId: string): Promise<BrandResult>;
  getCampaignStatus(campaignId: string): Promise<CampaignResult>;

  verifyWebhook(input: WebhookVerificationInput): boolean | Promise<boolean>;
  parseInboundMessage(payload: unknown): ParsedInboundMessage;
  parseDeliveryStatus(payload: unknown): ParsedDeliveryStatus;
}
