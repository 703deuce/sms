/**
 * Native Telnyx MessagingProvider.
 */

import { verify, createPublicKey } from "crypto";
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
import type { NumberSearchOptions, NumberSearchResult } from "../types";
import { telnyxRequest } from "./client";
import {
  assertTelnyxConfigured,
  getTelnyxPublicKey,
  getTelnyxUseTwexit,
  getTelnyxOrgId,
  getTelnyxApiKey,
  getTelnyxWebhookUrls,
} from "./config";
import {
  isTelnyxOrderId,
  pollTelnyxPhoneNumberId,
  toTelnyxOrderRef,
} from "./phone-numbers";
import { unwrapTelnyxData } from "../provider-ids";
import { mapTelnyxVertical, pickCampaignStatus } from "./status-map";

type TelnyxListResponse<T> = { data: T[] };
type TelnyxDataResponse<T> = { data: T };

const WEBHOOK_MAX_SKEW_SECONDS = 300;

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

function extractPhone(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return extractPhone(value[0]);
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.phone_number === "string") return o.phone_number;
    if (typeof o.phoneNumber === "string") return o.phoneNumber;
    if (typeof o.number === "string") return o.number;
  }
  return "";
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

    const urls = getTelnyxWebhookUrls();
    const body: Record<string, unknown> = {
      to: input.to,
      text: input.body,
      type: input.mediaUrls?.length ? "MMS" : "SMS",
    };
    if (from) body.from = from;
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId;
    if (input.mediaUrls?.length) body.media_urls = input.mediaUrls;
    const statusUrl = input.statusCallbackUrl || urls.messaging;
    body.webhook_url = statusUrl;
    body.webhook_failover_url = statusUrl;

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

  async searchNumbers(
    areaCode?: string,
    options?: NumberSearchOptions,
  ): Promise<NumberSearchResult[]> {
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
        "filter[features]": options?.mms ? "sms,mms" : "sms",
        "filter[limit]": 20,
        ...(areaCode ? { "filter[national_destination_code]": areaCode } : {}),
        ...(options?.locality ? { "filter[locality]": options.locality } : {}),
        ...(options?.administrativeArea
          ? { "filter[administrative_area]": options.administrativeArea }
          : {}),
        ...(options?.contains
          ? { "filter[phone_number][contains]": options.contains }
          : {}),
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
    const res = await telnyxRequest<
      TelnyxDataResponse<{
        id: string;
        status?: string;
        phone_numbers?: Array<{ id?: string; phone_number?: string; status?: string }>;
      }>
    >("/number_orders", {
      method: "POST",
      body: {
        phone_numbers: [{ phone_number: phoneNumber }],
      },
      idempotencyKey: `number-order:${phoneNumber}`,
    });

    const orderId = res.data.id;
    const purchased = res.data.phone_numbers?.[0];
    const e164 = purchased?.phone_number || phoneNumber;

    let phoneNumberId =
      purchased?.id && purchased.status === "success" ? purchased.id : null;
    if (!phoneNumberId) {
      phoneNumberId = await pollTelnyxPhoneNumberId({
        orderId,
        phoneNumber: e164,
        attempts: 6,
        delayMs: 1500,
      });
    }

    if (!phoneNumberId) {
      // Order accepted but resource id not ready — advance will resolve ORDER: refs.
      return {
        id: toTelnyxOrderRef(orderId),
        phoneNumber: e164,
        orderId,
        pending: true,
      };
    }

    return {
      id: phoneNumberId,
      phoneNumber: e164,
      orderId,
      pending: false,
    };
  },

  async releasePhoneNumber(_reg, phoneNumberId) {
    assertTelnyxConfigured();
    if (isTelnyxOrderId(phoneNumberId) || phoneNumberId.startsWith("PENDING:")) {
      return { ok: true as const };
    }
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
          // Single profile webhook receives inbound + delivery lifecycle events.
          webhook_url: urls.messaging,
          webhook_failover_url: urls.messaging,
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
    if (isTelnyxOrderId(phoneNumberId)) {
      throw new Error("Cannot attach pending number order — resolve phone number id first");
    }
    // Messaging profile assignment uses /phone_numbers/{id}/messaging — not the base PATCH.
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(phoneNumberId)}/messaging`, {
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
    const urls = getTelnyxWebhookUrls();
    const certifiedKey = reg.certifiedAt
      ? new Date(reg.certifiedAt).getTime()
      : "uncertified";
    const res = await telnyxRequest("/10dlc/brand", {
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
        vertical: mapTelnyxVertical(reg.businessIndustry, reg.vertical),
        webhookURL: urls.compliance,
      },
      idempotencyKey: `telnyx-brand:${reg.workspaceId}:${certifiedKey}`,
    });
    const body = unwrapTelnyxData<{
      brandId?: string;
      id?: string;
      status?: string;
      identityStatus?: string;
    }>(res);
    const id = body.brandId || body.id;
    if (!id) throw new Error("Telnyx brand create returned no id");
    return {
      id,
      status: body.identityStatus || body.status || "pending",
    };
  },

  async createCampaign(reg): Promise<CampaignResult> {
    assertTelnyxConfigured();
    const brandId =
      (reg as MessagingRegistration & { brandId?: string | null }).brandId || reg.brandSid;
    if (!brandId) throw new Error("Campaign requires brand_id");
    if (!reg.useCaseDescription) throw new Error("Campaign requires use case description");

    const urls = getTelnyxWebhookUrls();
    const samples = reg.sampleMessages || [];
    const certifiedKey = reg.certifiedAt
      ? new Date(reg.certifiedAt).getTime()
      : "uncertified";
    const helpMessage =
      reg.helpMessage ||
      "Transovo AI Support: For assistance, visit https://transovo.ai or email support@transovo.ai. Reply STOP to opt out.";
    const optoutMessage =
      reg.stopMessage ||
      "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.";
    const res = await telnyxRequest("/10dlc/campaignBuilder", {
      method: "POST",
      body: {
        brandId,
        usecase: mapUseCase(reg.useCase),
        description: reg.useCaseDescription,
        sample1: samples[0] || "Thanks for contacting us. Reply STOP to opt out.",
        sample2: samples[1] || "Your appointment reminder. Reply STOP to opt out.",
        messageFlow:
          reg.optInDescription ||
          "Customer provides phone number and consent on website or intake form.",
        helpMessage,
        optinMessage: "You have been re-subscribed. Reply STOP to opt out.",
        optoutMessage,
        optinKeywords: "START,YES",
        optoutKeywords: "STOP,UNSUBSCRIBE,CANCEL,END,QUIT",
        helpKeywords: "HELP,INFO",
        subscriberOptin: true,
        subscriberOptout: true,
        subscriberHelp: true,
        embeddedLink: true,
        numberPool: false,
        ageGated: false,
        webhookURL: urls.compliance,
      },
      idempotencyKey: `telnyx-campaign:${reg.workspaceId}:${brandId}:${certifiedKey}`,
    });
    const body = unwrapTelnyxData<{
      campaignId?: string;
      id?: string;
      status?: string;
      campaignStatus?: string;
    }>(res);
    const id = body.campaignId || body.id;
    if (!id) throw new Error("Telnyx campaign create returned no id");
    return { id, status: pickCampaignStatus(body) };
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
    const res = await telnyxRequest(`/10dlc/brand/${brandId}`);
    const body = unwrapTelnyxData<{
      brandId?: string;
      id?: string;
      status?: string;
      identityStatus?: string;
    }>(res);
    return {
      id: body.brandId || body.id || brandId,
      // Prefer TCR identityStatus when present (VERIFIED / VETTED_VERIFIED / …).
      status: body.identityStatus || body.status || "unknown",
    };
  },

  async getCampaignStatus(campaignId) {
    assertTelnyxConfigured();
    // Prefer campaignBuilder resource — exposes campaignStatus lifecycle enum.
    let res: unknown;
    try {
      res = await telnyxRequest(`/10dlc/campaignBuilder/${campaignId}`);
    } catch {
      res = await telnyxRequest(`/10dlc/campaign/${campaignId}`);
    }
    const body = unwrapTelnyxData<{
      campaignId?: string;
      id?: string;
      status?: string;
      campaignStatus?: string;
    }>(res);
    return {
      id: body.campaignId || body.id || campaignId,
      status: pickCampaignStatus(body),
    };
  },

  async verifyWebhook(input: WebhookVerificationInput) {
    const publicKey = getTelnyxPublicKey();
    if (!publicKey) {
      // Fail closed when an API key is present (live-ish). Local without keys can pass.
      return !getTelnyxApiKey();
    }
    if (!input.signature || !input.timestamp) return false;

    const ts = Number(input.timestamp);
    if (!Number.isFinite(ts)) return false;
    // Telnyx sends unix seconds; reject replayed/skewed payloads.
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > WEBHOOK_MAX_SKEW_SECONDS) return false;

    const body =
      typeof input.payload === "string" ? input.payload : input.payload.toString("utf8");
    const signedPayload = `${input.timestamp}|${body}`;

    try {
      const keyObject = buildTelnyxPublicKey(publicKey);
      if (!keyObject) return false;
      const sig = Buffer.from(input.signature, "base64");
      return verify(null, Buffer.from(signedPayload), keyObject, sig);
    } catch {
      return false;
    }
  },

  parseInboundMessage(payload: unknown): ParsedInboundMessage {
    const root = asRecord(payload) || {};
    const data = asRecord(root.data) || root;
    const payloadObj = asRecord(data.payload) || data;
    const from = extractPhone(payloadObj.from ?? payloadObj.From);
    const to = extractPhone(payloadObj.to ?? payloadObj.To);
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

function buildTelnyxPublicKey(publicKey: string) {
  const trimmed = publicKey.trim();
  try {
    if (trimmed.includes("BEGIN PUBLIC KEY")) {
      return createPublicKey(trimmed);
    }
    // Raw base64 32-byte ed25519 public key → SPKI DER
    const raw = Buffer.from(trimmed, "base64");
    if (raw.length === 32) {
      const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
      const der = Buffer.concat([derPrefix, raw]);
      return createPublicKey({ key: der, format: "der", type: "spki" });
    }
    return createPublicKey(trimmed);
  } catch {
    return null;
  }
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
