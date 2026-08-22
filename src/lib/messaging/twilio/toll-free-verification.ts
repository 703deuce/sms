import type { MessagingRegistration } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { isLiveMessagingAdapter, getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import { mapTwilioTfvFromProviderRecord, mapTwilioTfvStatus } from "@/lib/messaging/compliance/messaging-compliance";
import { mapTfvBusinessType } from "@/lib/messaging/twilio-mappings";

export type TwilioTfvSubmitInput = {
  reg: MessagingRegistration;
  tollfreePhoneNumberSid: string;
  externalReferenceId: string;
  businessName: string;
  businessWebsite: string;
  notificationEmail: string;
  useCaseSummary: string;
  productionMessageSample: string;
  optInType: "VERBAL" | "WEB_FORM" | "PAPER_FORM" | "VIA_TEXT";
  optInImageUrls: string[];
  messageVolume?: string;
  businessStreetAddress?: string;
  businessCity?: string;
  businessStateProvinceRegion?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  businessContactFirstName?: string;
  businessContactLastName?: string;
  businessContactEmail?: string;
  businessContactPhone?: string;
  additionalInformation?: string;
  customerProfileSid?: string;
  businessType?: string;
  businessRegistrationNumber?: string;
  businessRegistrationCountry?: string;
};

export type TwilioTfvSubmitResult = {
  sid: string;
  status: string;
  raw: Record<string, unknown>;
};

function requireSubaccountClient(reg: MessagingRegistration) {
  if (!reg.subaccountSid || !reg.subaccountAuthTokenEnc) {
    throw new Error("Twilio subaccount is not provisioned for this workspace");
  }
  const authToken = decryptSecret(reg.subaccountAuthTokenEnc);
  return getSubaccountTwilioClient(reg.subaccountSid, authToken);
}

/** Submit toll-free verification via Twilio Messaging API (not A2P/10DLC). */
export async function submitTwilioTollFreeVerification(
  input: TwilioTfvSubmitInput,
): Promise<TwilioTfvSubmitResult> {
  if (!isLiveMessagingAdapter()) {
    const sid = `TFV_MOCK_${input.externalReferenceId.slice(0, 20)}`;
    return {
      sid,
      status: process.env.MOCK_TFV_AUTO_APPROVE === "1" ? "TWILIO_APPROVED" : "PENDING_REVIEW",
      raw: { mock: true, sid, status: "PENDING_REVIEW" },
    };
  }

  const client = requireSubaccountClient(input.reg);
  const tfvBusinessType = mapTfvBusinessType(input.businessType || input.reg.businessType || "llc");
  const verification = await client.messaging.v1.tollfreeVerifications.create({
    businessName: input.businessName,
    businessWebsite: input.businessWebsite,
    notificationEmail: input.notificationEmail,
    useCaseCategories: ["CUSTOMER_CARE"],
    useCaseSummary: input.useCaseSummary,
    productionMessageSample: input.productionMessageSample,
    optInImageUrls: input.optInImageUrls.length
      ? input.optInImageUrls
      : [`${getAppBaseUrl()}/compliance`],
    optInType: input.optInType,
    messageVolume: input.messageVolume || "100",
    tollfreePhoneNumberSid: input.tollfreePhoneNumberSid,
    externalReferenceId: input.externalReferenceId,
    businessStreetAddress: input.businessStreetAddress,
    businessCity: input.businessCity,
    businessStateProvinceRegion: input.businessStateProvinceRegion,
    businessPostalCode: input.businessPostalCode,
    businessCountry: input.businessCountry || "US",
    businessContactFirstName: input.businessContactFirstName,
    businessContactLastName: input.businessContactLastName,
    businessContactEmail: input.businessContactEmail,
    businessContactPhone: input.businessContactPhone,
    additionalInformation: input.additionalInformation,
    customerProfileSid: input.customerProfileSid || undefined,
    businessType: tfvBusinessType,
    businessRegistrationNumber:
      input.businessRegistrationNumber || input.reg.businessRegistrationId || undefined,
    businessRegistrationAuthority:
      tfvBusinessType === "SOLE_PROPRIETOR"
        ? undefined
        : ((input.businessRegistrationCountry ||
            input.reg.country ||
            input.businessCountry ||
            "US") === "US"
            ? "EIN"
            : "OTHER"),
    businessRegistrationCountry:
      input.businessRegistrationCountry || input.reg.country || input.businessCountry || "US",
  });

  return {
    sid: verification.sid,
    status: String(verification.status || "PENDING_REVIEW"),
    raw: verification as unknown as Record<string, unknown>,
  };
}

/** Update an editable toll-free verification (ACTION_REQUIRED resubmit). */
export async function updateTwilioTollFreeVerification(
  input: TwilioTfvSubmitInput & { verificationSid: string },
): Promise<TwilioTfvSubmitResult> {
  if (!isLiveMessagingAdapter()) {
    return {
      sid: input.verificationSid,
      status: process.env.MOCK_TFV_AUTO_APPROVE === "1" ? "TWILIO_APPROVED" : "PENDING_REVIEW",
      raw: { mock: true, sid: input.verificationSid, status: "PENDING_REVIEW", updated: true },
    };
  }

  const client = requireSubaccountClient(input.reg);
  const verification = await client.messaging.v1
    .tollfreeVerifications(input.verificationSid)
    .update({
      businessName: input.businessName,
      businessWebsite: input.businessWebsite,
      notificationEmail: input.notificationEmail,
      useCaseCategories: ["CUSTOMER_CARE"],
      useCaseSummary: input.useCaseSummary,
      productionMessageSample: input.productionMessageSample,
      optInImageUrls: input.optInImageUrls.length
        ? input.optInImageUrls
        : [`${getAppBaseUrl()}/compliance`],
      optInType: input.optInType,
      messageVolume: input.messageVolume || "100",
      businessStreetAddress: input.businessStreetAddress,
      businessCity: input.businessCity,
      businessStateProvinceRegion: input.businessStateProvinceRegion,
      businessPostalCode: input.businessPostalCode,
      businessCountry: input.businessCountry || "US",
      businessContactFirstName: input.businessContactFirstName,
      businessContactLastName: input.businessContactLastName,
      businessContactEmail: input.businessContactEmail,
      businessContactPhone: input.businessContactPhone,
      additionalInformation: input.additionalInformation,
    });

  return {
    sid: verification.sid,
    status: String(verification.status || "PENDING_REVIEW"),
    raw: verification as unknown as Record<string, unknown>,
  };
}

export async function fetchTwilioTollFreeVerification(input: {
  reg: MessagingRegistration;
  verificationSid: string;
}): Promise<{ status: string; mapped: ReturnType<typeof mapTwilioTfvStatus>; raw: Record<string, unknown> }> {
  if (!isLiveMessagingAdapter()) {
    const auto = process.env.MOCK_TFV_AUTO_APPROVE === "1";
    const status = auto ? "TWILIO_APPROVED" : "PENDING_REVIEW";
    return { status, mapped: mapTwilioTfvStatus(status), raw: { mock: true, status } };
  }

  const client = requireSubaccountClient(input.reg);
  const verification = await client.messaging.v1.tollfreeVerifications(input.verificationSid).fetch();
  const raw = verification as unknown as Record<string, unknown>;
  const status = String(verification.status || "");
  return {
    status,
    mapped: mapTwilioTfvFromProviderRecord(raw),
    raw,
  };
}

/** Find existing TFV by external reference (workspace id) for idempotent submit. */
export async function findTwilioTfvByExternalReference(input: {
  reg: MessagingRegistration;
  externalReferenceId: string;
  tollfreePhoneNumberSid: string;
}): Promise<TwilioTfvSubmitResult | null> {
  if (!isLiveMessagingAdapter()) return null;

  const client = requireSubaccountClient(input.reg);
  const list = await client.messaging.v1.tollfreeVerifications.list({
    externalReferenceId: input.externalReferenceId,
    tollfreePhoneNumberSid: input.tollfreePhoneNumberSid,
    limit: 5,
  });
  const existing = list[0];
  if (!existing) return null;
  return {
    sid: existing.sid,
    status: String(existing.status || "PENDING_REVIEW"),
    raw: existing as unknown as Record<string, unknown>,
  };
}

export async function findTfvByPhoneSid(input: {
  reg: MessagingRegistration;
  tollfreePhoneNumberSid: string;
}): Promise<TwilioTfvSubmitResult | null> {
  if (!isLiveMessagingAdapter()) return null;
  const client = requireSubaccountClient(input.reg);
  const list = await client.messaging.v1.tollfreeVerifications.list({
    tollfreePhoneNumberSid: input.tollfreePhoneNumberSid,
    limit: 5,
  });
  const existing = list[0];
  if (!existing) return null;
  return {
    sid: existing.sid,
    status: String(existing.status || "PENDING_REVIEW"),
    raw: existing as unknown as Record<string, unknown>,
  };
}
