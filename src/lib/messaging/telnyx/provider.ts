/**
 * Native Telnyx MessagingProvider.
 * Phase 1: outbound send + number search skeleton.
 * Brand/campaign/webhook parsers land in Phases 2–3.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { MessagingRegistration } from "@/lib/domain";
import type {
  BrandResult,
  CampaignResult,
  MessagingProvider,
  MessagingProfileResult,
  ParsedDeliveryStatus,
  ParsedInboundMessage,
  PurchasedNumber,
  SendMessageInput,
  SendMessageResult,
  WebhookVerificationInput,
} from "../provider";
import type { NumberSearchResult } from "../types";
import { telnyxRequest } from "./client";
import {
  assertTelnyxConfigured,
  getTelnyxPublicKey,
  getTelnyxUseTwexit,
  getTelnyxOrgId,
  getTelnyxApiKey,
  getTelnyxWebhookUrls,
} from "./config";

type TelnyxListResponse<T> = { data: T[] };
type TelnyxDataResponse<T> = { data: T };

function notReady(feature: string): never {
  throw new Error(
    `TelnyxProvider.${feature} is not fully implemented yet. See docs/TELNYX_MIGRATION.md Phase 2–3.`,
  );
}

function mapDeliveryStatus(status: string): ParsedDeliveryStatus["internalStatus"] {
  const s = status.toLowerCase();
  if (s === "queued" || s === "sending") return "queued";
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "delivery_failed" || s === "failed") return "failed";
  if (s === "delivery_unconfirmed") return "undelivered";
  if (s.includes("expired")) return "expired";
  return "unknown";
}

export const telnyxProvider: MessagingProvider = {
  name: "telnyx",

  async sendMessage(reg, input): Promise<SendMessageResult> {
    assertTelnyxConfigured();

    if (getTelnyxUseTwexit()) {
      return sendViaTwexit(reg, input);
    }

    const from = input.from || reg.phoneE164 || undefined;
    const messagingProfileId =
      input.messagingProfileId ||
      (reg as MessagingRegistration & { messagingProfileId?: string | null }).messagingProfileId ||
      undefined;

    if (!from && !messagingProfileId) {
      throw new Error("Telnyx send requires from number or messaging_profile_id");
    }

    const body: Record<string, unknown> = {
      to: input.to,
      text: input.body,
      type: input.mediaUrls?.length ? "MMS" : "SMS",
    };
    if (from) body.from = from;
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId;
    if (input.mediaUrls?.length) body.media_urls = input.mediaUrls;
    if (input.statusCallbackUrl) {
      body.webhook_url = input.statusCallbackUrl;
      body.webhook_failover_url = input.statusCallbackUrl;
    } else {
      const urls = getTelnyxWebhookUrls();
      body.webhook_url = urls.messageStatus;
    }

    const res = await telnyxRequest<TelnyxDataResponse<{ id: string; to?: Array<{ status?: string }> }>>(
      "/messages",
      { method: "POST", body },
    );

    const status = res.data?.to?.[0]?.status || "queued";
    return {
      providerMessageId: res.data.id,
      status,
      raw: res,
    };
  },

  async sendMms(reg, input) {
    if (!input.mediaUrls?.length) {
      throw new Error("sendMms requires mediaUrls");
    }
    return this.sendMessage(reg, input);
  },

  async searchNumbers(areaCode?: string): Promise<NumberSearchResult[]> {
    assertTelnyxConfigured();
    const res = await telnyxRequest<
      TelnyxListResponse<{
        phone_number: string;
        locality?: string;
        region_information?: Array<{ region_name?: string; region_type?: string }>;
        features?: Array<{ name?: string }>;
      }>
    >("/available_phone_numbers", {
      query: {
        "filter[country_code]": "US",
        "filter[features]": "sms",
        "filter[limit]": 20,
        ...(areaCode ? { "filter[national_destination_code]": areaCode } : {}),
      },
    });

    return (res.data || []).map((n) => {
      const region =
        n.region_information?.find((r) => r.region_type === "state")?.region_name ||
        n.region_information?.[0]?.region_name;
      return {
        phoneNumber: n.phone_number,
        friendlyName: n.phone_number,
        locality: n.locality,
        region,
        isoCountry: "US",
        capabilities: {
          sms: true,
          mms: Boolean(n.features?.some((f) => f.name?.toLowerCase() === "mms")),
          voice: Boolean(n.features?.some((f) => f.name?.toLowerCase() === "voice")),
        },
      };
    });
  },

  async buyPhoneNumber(_reg, phoneNumber): Promise<PurchasedNumber> {
    assertTelnyxConfigured();
    const res = await telnyxRequest<TelnyxDataResponse<{ id: string; phone_numbers?: Array<{ id: string; phone_number: string }> }>>(
      "/number_orders",
      {
        method: "POST",
        body: {
          phone_numbers: [{ phone_number: phoneNumber }],
        },
        idempotencyKey: `number-order:${phoneNumber}`,
      },
    );
    const purchased = res.data.phone_numbers?.[0];
    return {
      id: purchased?.id || res.data.id,
      phoneNumber: purchased?.phone_number || phoneNumber,
    };
  },

  async releasePhoneNumber(_reg, phoneNumberId) {
    assertTelnyxConfigured();
    await telnyxRequest(`/phone_numbers/${phoneNumberId}`, { method: "DELETE" });
    return { ok: true as const };
  },

  async createMessagingProfile(reg): Promise<MessagingProfileResult> {
    assertTelnyxConfigured();
    const urls = getTelnyxWebhookUrls();
    const name = `${reg.legalBusinessName || reg.workspaceId} Messaging`;
    const res = await telnyxRequest<TelnyxDataResponse<{ id: string; name?: string }>>(
      "/messaging_profiles",
      {
        method: "POST",
        body: {
          name,
          webhook_url: urls.inbound,
          webhook_failover_url: urls.inbound,
          webhook_api_version: "2",
          enabled: true,
        },
        idempotencyKey: `msg-profile:${reg.workspaceId}`,
      },
    );
    return { id: res.data.id, name: res.data.name || name };
  },

  async assignNumberToMessagingProfile(phoneNumberId, messagingProfileId) {
    assertTelnyxConfigured();
    await telnyxRequest(`/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      body: { messaging_profile_id: messagingProfileId },
    });
    return { ok: true as const };
  },

  async createBrand(reg): Promise<BrandResult> {
    assertTelnyxConfigured();
    if (!reg.legalBusinessName || !reg.businessRegistrationId || !reg.websiteUrl) {
      throw new Error("Brand registration requires legal name, EIN/tax ID, and website");
    }
    const res = await telnyxRequest<TelnyxDataResponse<{ brandId?: string; id?: string; status?: string }>>(
      "/10dlc/brand",
      {
        method: "POST",
        body: {
          entityType: mapEntityType(reg.businessType),
          displayName: reg.dbaName || reg.legalBusinessName,
          companyName: reg.legalBusinessName,
          ein: reg.businessRegistrationId,
          phone: reg.contactPhone,
          street: reg.street,
          city: reg.city,
          state: reg.region,
          postalCode: reg.postalCode,
          country: reg.country || "US",
          email: reg.contactEmail,
          website: reg.websiteUrl,
          vertical: reg.vertical || reg.businessIndustry || "PROFESSIONAL",
        },
      },
    );
    const id = res.data.brandId || res.data.id;
    if (!id) throw new Error("Telnyx brand create returned no id");
    return { id, status: res.data.status || "pending" };
  },

  async createCampaign(reg): Promise<CampaignResult> {
    assertTelnyxConfigured();
    const brandId =
      (reg as MessagingRegistration & { brandId?: string | null }).brandId || reg.brandSid;
    if (!brandId) throw new Error("Campaign requires brand_id");
    if (!reg.useCaseDescription) throw new Error("Campaign requires use case description");

    const samples = reg.sampleMessages || [];
    const res = await telnyxRequest<TelnyxDataResponse<{ campaignId?: string; id?: string; status?: string }>>(
      "/10dlc/campaignBuilder",
      {
        method: "POST",
        body: {
          brandId,
          usecase: mapUseCase(reg.useCase),
          description: reg.useCaseDescription,
          sample1: samples[0] || "Thanks for contacting us. Reply STOP to opt out.",
          sample2: samples[1] || "Your appointment reminder. Reply STOP to opt out.",
          messageFlow: reg.optInDescription || "Customer provides phone number and consent on website or intake form.",
          helpMessage:
            reg.helpMessage ||
            "Reply HELP for help. Reply STOP to opt out. Message and data rates may apply.",
          optinKeywords: "START,YES",
          optoutKeywords: "STOP,UNSUBSCRIBE,CANCEL,END,QUIT",
          helpKeywords: "HELP,INFO",
          subscriberOptin: true,
          subscriberOptout: true,
          subscriberHelp: true,
          embeddedLink: true,
          numberPool: false,
          ageGated: false,
        },
      },
    );
    const id = res.data.campaignId || res.data.id;
    if (!id) throw new Error("Telnyx campaign create returned no id");
    return { id, status: res.data.status || "pending" };
  },

  async assignCampaignToNumber(phoneNumber, campaignId) {
    assertTelnyxConfigured();
    await telnyxRequest("/10dlc/phoneNumberCampaign", {
      method: "POST",
      body: { phoneNumber, campaignId },
    });
    return { ok: true as const };
  },

  async getBrandStatus(brandId) {
    assertTelnyxConfigured();
    const res = await telnyxRequest<TelnyxDataResponse<{ brandId?: string; id?: string; status?: string }>>(
      `/10dlc/brand/${brandId}`,
    );
    return {
      id: res.data.brandId || res.data.id || brandId,
      status: res.data.status || "unknown",
    };
  },

  async getCampaignStatus(campaignId) {
    assertTelnyxConfigured();
    const res = await telnyxRequest<TelnyxDataResponse<{ campaignId?: string; id?: string; status?: string }>>(
      `/10dlc/campaign/${campaignId}`,
    );
    return {
      id: res.data.campaignId || res.data.id || campaignId,
      status: res.data.status || "unknown",
    };
  },

  async verifyWebhook(input: WebhookVerificationInput) {
    // Telnyx ed25519 verification typically uses TELNYX_PUBLIC_KEY.
    // Until public-key crypto wiring is finalized, reject when key is configured
    // but signature missing; allow unsigned only in non-live local mock testing.
    const publicKey = getTelnyxPublicKey();
    if (!publicKey) {
      // Fail closed in production-ish configs that have an API key.
      return !process.env.TELNYX_API_KEY;
    }
    if (!input.signature || !input.timestamp) return false;

    // Compatibility path: HMAC compare if public key is treated as shared secret
    // (native ed25519 verification will replace this in Phase 2).
    try {
      const signedPayload = `${input.timestamp}|${typeof input.payload === "string" ? input.payload : input.payload.toString("utf8")}`;
      const expected = createHmac("sha256", publicKey).update(signedPayload).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(input.signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseInboundMessage(payload: unknown): ParsedInboundMessage {
    const root = asRecord(payload) || {};
    const data = asRecord(root.data) || root;
    const payloadObj = asRecord(data.payload) || data;
    const from = String(payloadObj.from || payloadObj.From || "");
    const toRaw = payloadObj.to ?? payloadObj.To ?? "";
    const to = Array.isArray(toRaw)
      ? String((toRaw[0] as { phone_number?: string })?.phone_number || toRaw[0] || "")
      : String(toRaw);
    const body = String(payloadObj.text || payloadObj.body || payloadObj.Body || "");
    const id = String(payloadObj.id || payloadObj.message_id || data.id || "");
    const media = Array.isArray(payloadObj.media)
      ? payloadObj.media.map((m: unknown) => String(asRecord(m)?.url || m)).filter(Boolean)
      : [];
    return {
      providerMessageId: id,
      from,
      to,
      body,
      mediaUrls: media,
      raw: payload,
    };
  },

  parseDeliveryStatus(payload: unknown): ParsedDeliveryStatus {
    const root = asRecord(payload) || {};
    const data = asRecord(root.data) || root;
    const payloadObj = asRecord(data.payload) || data;
    const toArr = Array.isArray(payloadObj.to) ? payloadObj.to : [];
    const providerStatus = String(toArr[0]?.status || payloadObj.status || "unknown");
    const errors = Array.isArray(payloadObj.errors) ? payloadObj.errors : [];
    return {
      providerMessageId: String(payloadObj.id || data.id || ""),
      providerStatus,
      internalStatus: mapDeliveryStatus(providerStatus),
      errorCode: errors[0]?.code != null ? String(errors[0].code) : null,
      errorDetail: errors[0]?.detail != null ? String(errors[0].detail) : null,
      raw: payload,
    };
  },
};

async function sendViaTwexit(
  reg: MessagingRegistration,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const orgId = getTelnyxOrgId();
  const apiKey = getTelnyxApiKey();
  if (!orgId || !apiKey) {
    throw new Error("Twexit requires TELNYX_ORG_ID and TELNYX_API_KEY");
  }
  const from = input.from || reg.phoneE164;
  if (!from) throw new Error("Twexit send requires From number");

  const auth = Buffer.from(`${orgId}:${apiKey}`).toString("base64");
  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", input.to);
  form.set("Body", input.body);
  if (input.statusCallbackUrl) form.set("StatusCallback", input.statusCallbackUrl);

  const res = await fetch(
    `https://api.telnyx.com/2010-04-01/Accounts/${orgId}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  const json = (await res.json()) as { sid?: string; status?: string; error_message?: string };
  if (!res.ok) {
    throw new Error(json.error_message || `Twexit send failed (${res.status})`);
  }
  return {
    providerMessageId: String(json.sid || ""),
    status: String(json.status || "queued"),
    raw: json,
  };
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" ? (value as Record<string, any>) : null;
}

function mapEntityType(businessType: string | null | undefined) {
  const t = (businessType || "").toLowerCase();
  if (t.includes("sole")) return "SOLE_PROPRIETOR";
  if (t.includes("corp")) return "PRIVATE_PROFIT";
  if (t.includes("non")) return "NON_PROFIT";
  if (t.includes("gov")) return "GOVERNMENT";
  return "PRIVATE_PROFIT";
}

function mapUseCase(useCase: string | null | undefined) {
  const u = (useCase || "").toLowerCase();
  if (u.includes("deliver")) return "DELIVERY_NOTIFICATION";
  if (u.includes("account")) return "ACCOUNT_NOTIFICATION";
  if (u.includes("2fa") || u.includes("otp")) return "2FA";
  if (u.includes("market") || u.includes("promo")) return "MARKETING";
  if (u.includes("customer")) return "CUSTOMER_CARE";
  return "MIXED";
}

// silence unused until Phase 3 wiring
void notReady;
