import type { MessagingRegistration } from "@prisma/client";
import { getLiveParentClient, getSubaccountTwilioClient } from "./twilio-client";
import { assertLiveTwilioConfigured, getStatusEmail, getWebhookUrls, TRUSTHUB_POLICIES } from "./twilio-config";
import { mapBusinessType, mapIndustry, mapUseCase } from "./twilio-mappings";
import type { NumberSearchResult } from "./types";
import { decryptSecret } from "./crypto";

function requireSubaccount(reg: MessagingRegistration) {
  if (!reg.subaccountSid || !reg.subaccountAuthTokenEnc) {
    throw new Error("Subaccount is not provisioned for this workspace");
  }
  const authToken = decryptSecret(reg.subaccountAuthTokenEnc);
  return getSubaccountTwilioClient(reg.subaccountSid, authToken);
}

export const twilioAdapter = {
  async createCustomerSubaccount(friendlyName: string) {
    assertLiveTwilioConfigured();
    const client = getLiveParentClient();
    const account = await client.api.accounts.create({ friendlyName });
    return {
      sid: account.sid,
      authToken: account.authToken,
      friendlyName: account.friendlyName,
    };
  },

  async searchNumbers(areaCode?: string): Promise<NumberSearchResult[]> {
    assertLiveTwilioConfigured();
    const client = getLiveParentClient();
    const list = await client.availablePhoneNumbers("US").local.list({
      areaCode: areaCode ? Number(areaCode) : undefined,
      smsEnabled: true,
      limit: 20,
    });
    return list.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      isoCountry: n.isoCountry,
      capabilities: n.capabilities as NumberSearchResult["capabilities"],
    }));
  },

  async purchaseNumber(reg: MessagingRegistration, phoneNumber: string) {
    const client = requireSubaccount(reg);
    const urls = getWebhookUrls();
    const number = await client.incomingPhoneNumbers.create({
      phoneNumber,
      smsUrl: urls.inbound,
      smsMethod: "POST",
      statusCallback: urls.messageStatus,
      statusCallbackMethod: "POST",
    });
    return { sid: number.sid, phoneNumber: number.phoneNumber };
  },

  async releaseNumber(reg: MessagingRegistration, phoneSid: string) {
    const client = requireSubaccount(reg);
    await client.incomingPhoneNumbers(phoneSid).remove();
    return { ok: true as const };
  },

  async createSecondaryProfileShell(reg: MessagingRegistration) {
    const { primaryProfileSid } = assertLiveTwilioConfigured();
    const client = requireSubaccount(reg);
    const email = getStatusEmail();
    const profile = await client.trusthub.v1.customerProfiles.create({
      friendlyName: `${reg.legalBusinessName || reg.workspaceId} Secondary Profile`,
      email: email || reg.contactEmail || "compliance@example.com",
      policySid: TRUSTHUB_POLICIES.secondaryCustomerProfile,
      statusCallback: getWebhookUrls().complianceStatus,
    });

    // Link under ISV primary profile
    await client.trusthub.v1.customerProfiles(primaryProfileSid).customerProfilesEntityAssignments.create({
      objectSid: profile.sid,
    });

    return { sid: profile.sid, status: profile.status, friendlyName: profile.friendlyName };
  },

  async submitSecondaryProfile(reg: MessagingRegistration) {
    if (!reg.secondaryProfileSid) throw new Error("Secondary profile SID missing");
    const client = requireSubaccount(reg);

    const businessAttrs = {
      business_name: reg.legalBusinessName,
      business_identity: reg.businessIdentity || "direct_customer",
      business_type: mapBusinessType(reg.businessType || "llc"),
      business_industry: mapIndustry(reg.businessIndustry || "professional_services"),
      business_registration_identifier: "EIN",
      business_registration_number: reg.businessRegistrationId,
      website_url: reg.websiteUrl,
    };

    const endUser = await client.trusthub.v1.endUsers.create({
      friendlyName: `${reg.legalBusinessName} Business Info`,
      type: "customer_profile_business_information",
      attributes: businessAttrs,
    });

    const authRep = await client.trusthub.v1.endUsers.create({
      friendlyName: `${reg.contactFirstName} ${reg.contactLastName} Auth Rep`,
      type: "authorized_representative_1",
      attributes: {
        first_name: reg.contactFirstName,
        last_name: reg.contactLastName,
        email: reg.contactEmail,
        phone_number: reg.contactPhone,
        business_title: reg.contactTitle || "Owner",
        job_position: "CEO",
      },
    });

    const address = await client.addresses.create({
      customerName: reg.legalBusinessName || "Business",
      street: reg.street || "",
      city: reg.city || "",
      region: reg.region || "",
      postalCode: reg.postalCode || "",
      isoCountry: reg.country || "US",
    });

    const supportingDoc = await client.trusthub.v1.supportingDocuments.create({
      friendlyName: `${reg.legalBusinessName} Address`,
      type: "customer_profile_address",
      attributes: { address_sids: address.sid },
    });

    const profileSid = reg.secondaryProfileSid;
    for (const objectSid of [endUser.sid, authRep.sid, supportingDoc.sid]) {
      await client.trusthub.v1.customerProfiles(profileSid).customerProfilesEntityAssignments.create({
        objectSid,
      });
    }

    await client.trusthub.v1.customerProfiles(profileSid).customerProfilesEvaluations.create({
      policySid: TRUSTHUB_POLICIES.secondaryCustomerProfile,
    });

    const submitted = await client.trusthub.v1.customerProfiles(profileSid).update({
      status: "pending-review",
    });

    return { sid: submitted.sid, status: submitted.status };
  },

  async createTrustProduct(reg: MessagingRegistration) {
    if (!reg.secondaryProfileSid) throw new Error("Secondary profile required before trust product");
    const client = requireSubaccount(reg);
    const email = getStatusEmail() || reg.contactEmail || "compliance@example.com";

    let trustSid = reg.trustProductSid;
    if (!trustSid) {
      const trust = await client.trusthub.v1.trustProducts.create({
        friendlyName: `${reg.legalBusinessName || reg.workspaceId} A2P Trust`,
        email,
        policySid: TRUSTHUB_POLICIES.a2pTrustProduct,
        statusCallback: getWebhookUrls().complianceStatus,
      });
      trustSid = trust.sid;

      await client.trusthub.v1.trustProducts(trustSid).trustProductsEntityAssignments.create({
        objectSid: reg.secondaryProfileSid,
      });

      const endUser = await client.trusthub.v1.endUsers.create({
        friendlyName: `${reg.legalBusinessName} A2P Messaging Profile`,
        type: "us_a2p_messaging_profile_information",
        attributes: {
          company_type: mapBusinessType(reg.businessType || "llc").includes("Non-profit") ? "non_profit" : "private",
        },
      });

      await client.trusthub.v1.trustProducts(trustSid).trustProductsEntityAssignments.create({
        objectSid: endUser.sid,
      });

      await client.trusthub.v1.trustProducts(trustSid).trustProductsEvaluations.create({
        policySid: TRUSTHUB_POLICIES.a2pTrustProduct,
      });
    }

    const submitted = await client.trusthub.v1.trustProducts(trustSid).update({
      status: "pending-review",
    });
    return { sid: submitted.sid, status: submitted.status };
  },

  async createBrandRegistration(reg: MessagingRegistration) {
    if (!reg.secondaryProfileSid || !reg.trustProductSid) {
      throw new Error("Profile + trust product required for brand registration");
    }
    const client = requireSubaccount(reg);

    if (reg.brandSid) {
      const existing = await client.messaging.v1.brandRegistrations(reg.brandSid).fetch();
      return { sid: existing.sid, status: existing.status };
    }

    const brand = await client.messaging.v1.brandRegistrations.create({
      customerProfileBundleSid: reg.secondaryProfileSid,
      a2PProfileBundleSid: reg.trustProductSid,
      brandType: "STANDARD",
      mock: false,
      skipAutomaticSecVet: true,
    });
    return { sid: brand.sid, status: brand.status };
  },

  async fetchBrandStatus(reg: MessagingRegistration) {
    if (!reg.brandSid) throw new Error("Brand SID missing");
    const client = requireSubaccount(reg);
    const brand = await client.messaging.v1.brandRegistrations(reg.brandSid).fetch();
    return { sid: brand.sid, status: brand.status };
  },

  async createMessagingService(reg: MessagingRegistration, friendlyName: string) {
    const client = requireSubaccount(reg);
    const urls = getWebhookUrls();
    if (reg.messagingServiceSid) {
      return { sid: reg.messagingServiceSid, friendlyName };
    }
    const ms = await client.messaging.v1.services.create({
      friendlyName,
      inboundRequestUrl: urls.inbound,
      inboundMethod: "POST",
      statusCallback: urls.messageStatus,
    });
    return { sid: ms.sid, friendlyName: ms.friendlyName };
  },

  async attachNumberToMessagingService(reg: MessagingRegistration) {
    if (!reg.messagingServiceSid || !reg.phoneSid) {
      throw new Error("Messaging service and phone SID required to attach");
    }
    const client = requireSubaccount(reg);
    try {
      await client.messaging.v1.services(reg.messagingServiceSid).phoneNumbers.create({
        phoneNumberSid: reg.phoneSid,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Already attached is fine
      if (!/already|exist/i.test(message)) throw err;
    }
    return { ok: true as const };
  },

  async createA2pCampaign(reg: MessagingRegistration) {
    if (!reg.messagingServiceSid || !reg.brandSid) {
      throw new Error("Messaging service + brand required for A2P campaign");
    }
    const client = requireSubaccount(reg);

    if (reg.a2pCampaignSid) {
      const existing = await client.messaging.v1
        .services(reg.messagingServiceSid)
        .usAppToPerson(reg.a2pCampaignSid)
        .fetch();
      return {
        sid: existing.sid,
        status: (existing as { campaignStatus?: string }).campaignStatus || "UNKNOWN",
      };
    }

    const samples = (reg.sampleMessages?.length ? reg.sampleMessages : [
      `Hi {{name}}, thanks for choosing ${reg.legalBusinessName || "us"}! Reply STOP to opt out.`,
      `${reg.legalBusinessName || "We"}: Your appointment reminder. Reply STOP to unsubscribe.`,
    ]).slice(0, 5);

    const campaign = await client.messaging.v1.services(reg.messagingServiceSid).usAppToPerson.create({
      brandRegistrationSid: reg.brandSid,
      description: reg.useCaseDescription || "Customer care and transactional notifications",
      messageFlow:
        reg.optInDescription ||
        "Customers opt in via website form, keyword, or verbal consent at point of service.",
      messageSamples: samples,
      usAppToPersonUsecase: mapUseCase(reg.useCase || "mixed"),
      hasEmbeddedLinks: true,
      hasEmbeddedPhone: true,
      optInMessage: undefined,
      optOutMessage: reg.stopMessage || "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.",
      helpMessage:
        reg.helpMessage ||
        `${reg.legalBusinessName || "Support"}: For help reply HELP or contact ${reg.contactEmail || "support"}. Msg&data rates may apply.`,
    });

    return {
      sid: campaign.sid,
      status: (campaign as { campaignStatus?: string }).campaignStatus || "PENDING",
    };
  },

  async fetchA2pCampaignStatus(reg: MessagingRegistration) {
    if (!reg.messagingServiceSid || !reg.a2pCampaignSid) {
      throw new Error("A2P campaign SID missing");
    }
    const client = requireSubaccount(reg);
    const campaign = await client.messaging.v1
      .services(reg.messagingServiceSid)
      .usAppToPerson(reg.a2pCampaignSid)
      .fetch();
    return {
      sid: campaign.sid,
      status: (campaign as { campaignStatus?: string }).campaignStatus || "UNKNOWN",
    };
  },

  async sendSmsViaMessagingService(
    reg: MessagingRegistration,
    input: { to: string; body: string },
  ) {
    if (!reg.messagingServiceSid) throw new Error("Messaging Service SID required");
    const client = requireSubaccount(reg);
    const urls = getWebhookUrls();
    const msg = await client.messages.create({
      to: input.to,
      body: input.body,
      messagingServiceSid: reg.messagingServiceSid,
      statusCallback: urls.messageStatus,
    });
    return { sid: msg.sid, status: msg.status, to: msg.to, messagingServiceSid: reg.messagingServiceSid };
  },
};
