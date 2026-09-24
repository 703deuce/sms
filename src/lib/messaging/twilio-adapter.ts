import type { MessagingRegistration } from "@/lib/domain";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";
import { getLiveParentClient, getSubaccountTwilioClient } from "./twilio-client";
import { assertLiveTwilioConfigured, getStatusEmail, getWebhookUrls, TRUSTHUB_POLICIES } from "./twilio-config";
import { mapBusinessType, mapIndustry, mapUseCase, mapA2pCompanyType } from "./twilio-mappings";
import type { NumberSearchOptions, NumberSearchResult } from "./types";
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

  async searchNumbers(areaCode?: string, options?: NumberSearchOptions): Promise<NumberSearchResult[]> {
    assertLiveTwilioConfigured();
    const client = getLiveParentClient();
    const ndc = areaCode?.replace(/\D/g, "").slice(0, 3);
    const useTollFree = ndc ? isTollFreeAreaCode(ndc) : false;
    const listParams = {
      areaCode: ndc ? Number(ndc) : undefined,
      contains: options?.contains?.replace(/\D/g, "") || undefined,
      smsEnabled: true,
      voiceEnabled: true,
      limit: 20,
    };
    const list = useTollFree
      ? await client.availablePhoneNumbers("US").tollFree.list(listParams)
      : await client.availablePhoneNumbers("US").local.list(listParams);
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
    const parent = getLiveParentClient();
    const email = getStatusEmail();
    const profile = await client.trusthub.v1.customerProfiles.create({
      friendlyName: `${reg.legalBusinessName || reg.workspaceId} Secondary Profile`,
      email: email || reg.contactEmail || "compliance@example.com",
      policySid: TRUSTHUB_POLICIES.secondaryCustomerProfile,
      statusCallback: getWebhookUrls().complianceStatus,
    });

    // Link secondary under ISV primary profile on the parent account
    await parent.trusthub.v1.customerProfiles(primaryProfileSid).customerProfilesEntityAssignments.create({
      objectSid: profile.sid,
    });

    return { sid: profile.sid, status: profile.status, friendlyName: profile.friendlyName };
  },

  async submitSecondaryProfile(reg: MessagingRegistration) {
    if (!reg.secondaryProfileSid) throw new Error("Secondary profile SID missing");
    const client = requireSubaccount(reg);
    const profileSid = reg.secondaryProfileSid;

    // Resume-safe: if entity assignments already exist, just evaluate + submit
    const existingAssignments = await client.trusthub.v1
      .customerProfiles(profileSid)
      .customerProfilesEntityAssignments.list({ limit: 50 });

    if (existingAssignments.length < 3) {
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
        attributes: { address_sids: [address.sid] },
      });

      for (const objectSid of [endUser.sid, authRep.sid, supportingDoc.sid]) {
        await client.trusthub.v1.customerProfiles(profileSid).customerProfilesEntityAssignments.create({
          objectSid,
        });
      }
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
          company_type: mapA2pCompanyType(reg.businessType || "llc"),
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

  async fetchSecondaryProfileStatus(reg: MessagingRegistration) {
    if (!reg.secondaryProfileSid) throw new Error("Secondary profile SID missing");
    const client = requireSubaccount(reg);
    const profile = await client.trusthub.v1.customerProfiles(reg.secondaryProfileSid).fetch();
    return { sid: profile.sid, status: profile.status };
  },

  async fetchTrustProductStatus(reg: MessagingRegistration) {
    if (!reg.trustProductSid) throw new Error("Trust product SID missing");
    const client = requireSubaccount(reg);
    const trust = await client.trusthub.v1.trustProducts(reg.trustProductSid).fetch();
    return { sid: trust.sid, status: trust.status };
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
      optInMessage:
        "You are opted in to messages from this business. Reply STOP to unsubscribe. Msg&data rates may apply.",
      optOutMessage: reg.stopMessage || "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.",
      helpMessage:
        reg.helpMessage ||
        `${reg.legalBusinessName || "Transovo AI"} Support: For assistance, visit https://transovo.ai or email ${reg.contactEmail || "support@transovo.ai"}. Reply STOP to opt out.`,
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
    input: { to: string; body: string; from?: string; messagingServiceSid?: string | null },
  ) {
    const client = requireSubaccount(reg);
    const urls = getWebhookUrls();
    const from = input.from?.trim();
    const messagingServiceSid = input.messagingServiceSid || reg.messagingServiceSid;

    if (from) {
      const msg = await client.messages.create({
        to: input.to,
        body: input.body,
        from,
        statusCallback: urls.messageStatus,
      });
      return {
        sid: msg.sid,
        status: msg.status,
        to: msg.to,
        messagingServiceSid: messagingServiceSid || null,
      };
    }

    if (!messagingServiceSid) throw new Error("Messaging Service SID or From E.164 required");
    const msg = await client.messages.create({
      to: input.to,
      body: input.body,
      messagingServiceSid,
      statusCallback: urls.messageStatus,
    });
    return { sid: msg.sid, status: msg.status, to: msg.to, messagingServiceSid };
  },
};
