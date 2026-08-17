import { twilioAdapter } from "@/lib/messaging/twilio-adapter";
import {
  assertLiveTwilioConfigured,
  getAppBaseUrl,
  getWebhookUrls,
} from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import { ensureRegistrationRow, getRegistrationByWorkspace } from "@/lib/messaging/store";
import type { MessagingRegistration } from "@/lib/domain";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";
import { runTwilioInventorySearches } from "./twilio-inventory-search";
import type {
  InventorySearchInput,
  InventorySearchResult,
  NumberProvider,
  NormalizedNumberCandidate,
  PurchaseNumberInput,
  PurchaseNumberResult,
} from "./types";
import { nationalNumberFromE164 } from "./normalize";
import { withProviderTiming } from "./observability";

/** Twilio available-number search does not return carrier cost — use list-price estimates. */
const TWILIO_ESTIMATED_COSTS = {
  local: { upfront: "1.00", monthly: "1.15" },
  tollfree: { upfront: "1.00", monthly: "2.15" },
} as const;

function extractTwilioCosts(e164: string, raw: Record<string, unknown>) {
  const digits = e164.replace(/\D/g, "");
  const npa =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1, 4)
      : digits.length >= 10
        ? digits.slice(0, 3)
        : "";
  const tollFree = isTollFreeAreaCode(npa);
  const estimate = tollFree ? TWILIO_ESTIMATED_COSTS.tollfree : TWILIO_ESTIMATED_COSTS.local;

  const monthlyRaw = raw.monthly_cost ?? raw.monthlyCost ?? raw.monthly_price;
  const upfrontRaw = raw.upfront_cost ?? raw.upfrontCost ?? raw.setup_cost;
  const hasApiCost = monthlyRaw != null || upfrontRaw != null;

  return {
    monthlyCost: monthlyRaw != null ? String(monthlyRaw) : estimate.monthly,
    upfrontCost: upfrontRaw != null ? String(upfrontRaw) : estimate.upfront,
    currency: "USD",
    costSource: hasApiCost ? "provider_api" : "estimate",
  };
}

function mapTwilioRaw(raw: {
  phoneNumber: string;
  friendlyName?: string;
  locality?: string;
  region?: string;
  raw: Record<string, unknown>;
}): NormalizedNumberCandidate {
  const costs = extractTwilioCosts(raw.phoneNumber, raw.raw);
  return {
    e164: raw.phoneNumber,
    nationalNumber: nationalNumberFromE164(raw.phoneNumber),
    provider: "twilio",
    providerReference:
      typeof raw.raw.sid === "string"
        ? raw.raw.sid
        : typeof raw.raw.phone_number === "string"
          ? raw.raw.phone_number
          : null,
    monthlyCost: costs.monthlyCost,
    upfrontCost: costs.upfrontCost,
    currency: costs.currency,
    locality: raw.locality ?? null,
    region: raw.region ?? null,
    rateCenter: null,
    capabilities: { voice: true, sms: true, mms: true },
    raw: { ...raw.raw, costSource: costs.costSource },
  };
}

export class TwilioNumberProvider implements NumberProvider {
  readonly id = "twilio" as const;

  isConfigured(): boolean {
    try {
      assertLiveTwilioConfigured();
      return true;
    } catch {
      return false;
    }
  }

  async searchInventory(input: InventorySearchInput): Promise<InventorySearchResult> {
    if (!this.isConfigured()) {
      return {
        candidates: [],
        attempts: [
          {
            provider: "twilio",
            strategy: "inventory",
            status: "skipped",
            error: "Twilio not configured",
          },
        ],
      };
    }

    return withProviderTiming("twilio", "search_inventory", async () => {
      const inventory = await runTwilioInventorySearches({
        areaCode: input.areaCode,
        keywordDigitStrings: input.keywordDigitStrings,
        memorablePatterns: input.memorablePatterns,
        baseLimit: input.baseLimit,
        matchStyle: input.matchStyle,
      });
      return {
        candidates: inventory.candidates.map(mapTwilioRaw),
        attempts: inventory.attempts,
      };
    }, input.areaCode);
  }

  async purchaseNumber(input: PurchaseNumberInput): Promise<PurchaseNumberResult> {
    return withProviderTiming("twilio", "purchase_number", async () => {
      await ensureRegistrationRow(input.workspaceId);
      const reg = (await getRegistrationByWorkspace(input.workspaceId)) as MessagingRegistration;
      const bought = await twilioAdapter.purchaseNumber(reg, input.e164);
      await this.configureVoiceWebhook(bought.sid, input.workspaceId);
      return {
        providerNumberId: bought.sid,
        providerOrderId: null,
        pending: false,
      };
    }, input.e164);
  }

  async checkAvailability(e164: string): Promise<boolean> {
    try {
      const client = getLiveParentClient();
      const digits = e164.replace(/\D/g, "");
      const national =
        digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (national.length !== 10) return false;
      const ndc = national.slice(0, 3);
      const useTollFree = isTollFreeAreaCode(ndc);
      const listParams = {
        areaCode: Number(ndc),
        contains: national.slice(3),
        limit: 20,
      };
      const list = useTollFree
        ? await client.availablePhoneNumbers("US").tollFree.list(listParams)
        : await client.availablePhoneNumbers("US").local.list(listParams);
      return list.some((n) => n.phoneNumber === e164);
    } catch {
      return false;
    }
  }

  async releaseNumber(providerNumberId: string, workspaceId: string): Promise<void> {
    await withProviderTiming("twilio", "release_number", async () => {
      await ensureRegistrationRow(workspaceId);
      const reg = (await getRegistrationByWorkspace(workspaceId)) as MessagingRegistration;
      await twilioAdapter.releaseNumber(reg, providerNumberId);
    }, providerNumberId);
  }

  async configureVoiceWebhook(providerNumberId: string, workspaceId: string): Promise<void> {
    const base = getAppBaseUrl();
    const voiceUrl = `${base}/api/webhooks/twilio/voice`;
    await ensureRegistrationRow(workspaceId);
    const reg = (await getRegistrationByWorkspace(workspaceId)) as MessagingRegistration;
    if (!reg.subaccountSid || !reg.subaccountAuthTokenEnc) {
      throw new Error("Twilio subaccount is not provisioned for this workspace");
    }
    const authToken = decryptSecret(reg.subaccountAuthTokenEnc);
    const client = getSubaccountTwilioClient(reg.subaccountSid, authToken);
    const urls = getWebhookUrls();
    await client.incomingPhoneNumbers(providerNumberId).update({
      voiceUrl,
      voiceMethod: "POST",
      smsUrl: urls.inbound,
      smsMethod: "POST",
      statusCallback: urls.messageStatus,
      statusCallbackMethod: "POST",
    });
  }
}

export const twilioNumberProvider = new TwilioNumberProvider();
