import type { MessagingRegistration } from "@/lib/domain";
import { randomBytes } from "crypto";
import type { NumberSearchResult } from "./types";

function sid(prefix: string) {
  return `${prefix}${randomBytes(16).toString("hex").slice(0, 32)}`;
}

/** Local/dev mock that advances A2P without calling Twilio. */
export const mockAdapter = {
  async createCustomerSubaccount(friendlyName: string) {
    return {
      sid: sid("AC"),
      authToken: randomBytes(16).toString("hex"),
      friendlyName,
    };
  },

  async searchNumbers(areaCode?: string): Promise<NumberSearchResult[]> {
    const ac = areaCode || "415";
    return [0, 1, 2, 3, 4].map((i) => {
      const suffix = String(1000 + i * 111).padStart(4, "0");
      const phoneNumber = `+1${ac}555${suffix}`.slice(0, 12);
      return {
        phoneNumber,
        friendlyName: `(${ac}) 555-${suffix}`,
        locality: "Mock City",
        region: "CA",
        isoCountry: "US",
        capabilities: { sms: true, mms: true, voice: true },
      };
    });
  },

  async purchaseNumber(_subaccountSid: string, phoneNumber: string) {
    return { sid: sid("PN"), phoneNumber };
  },

  async releaseNumber() {
    return { ok: true as const };
  },

  async createSecondaryProfileShell(reg: MessagingRegistration) {
    return { sid: sid("BU"), status: "draft" as const, friendlyName: reg.legalBusinessName || "Mock Business" };
  },

  async submitSecondaryProfile(reg: MessagingRegistration) {
    return { sid: reg.secondaryProfileSid || sid("BU"), status: "pending-review" as const };
  },

  async createTrustProduct(reg: MessagingRegistration) {
    return { sid: reg.trustProductSid || sid("BU"), status: "twilio-approved" as const };
  },

  async createBrandRegistration(reg: MessagingRegistration) {
    return { sid: reg.brandSid || sid("BN"), status: "APPROVED" as const };
  },

  async createMessagingService(friendlyName: string) {
    return { sid: sid("MG"), friendlyName };
  },

  async attachNumberToMessagingService() {
    return { ok: true as const };
  },

  async createA2pCampaign(reg: MessagingRegistration) {
    return { sid: reg.a2pCampaignSid || sid("QE"), status: "VERIFIED" as const };
  },

  async sendSmsViaMessagingService(input: {
    messagingServiceSid: string;
    to: string;
    body: string;
  }) {
    return {
      sid: sid("SM"),
      status: "queued" as const,
      to: input.to,
      messagingServiceSid: input.messagingServiceSid,
    };
  },
};
