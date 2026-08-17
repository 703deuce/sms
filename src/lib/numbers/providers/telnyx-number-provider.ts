import {
  runTelnyxInventorySearches,
  type TelnyxRawCandidate,
} from "@/lib/premium-numbers/telnyx-inventory-search";
import { assertTelnyxConfigured } from "@/lib/messaging/telnyx/config";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { ensureRegistrationRow, getRegistrationByWorkspace } from "@/lib/messaging/store";
import type { MessagingRegistration } from "@/lib/domain";
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

function mapTelnyxRaw(raw: TelnyxRawCandidate): NormalizedNumberCandidate {
  return {
    e164: raw.phoneNumber,
    nationalNumber: nationalNumberFromE164(raw.phoneNumber),
    provider: "telnyx",
    providerReference: typeof raw.raw?.id === "string" ? raw.raw.id : null,
    monthlyCost: raw.monthlyCost ?? null,
    upfrontCost: raw.upfrontCost ?? null,
    currency: raw.currency ?? null,
    locality: null,
    region: null,
    rateCenter: null,
    capabilities: { voice: true, sms: true, mms: true },
    vanityFormat: raw.vanityFormat,
    raw: {
      ...raw.raw,
      costSource:
        raw.monthlyCost || raw.upfrontCost ? "provider_api" : "unknown",
    },
  };
}

export class TelnyxNumberProvider implements NumberProvider {
  readonly id = "telnyx" as const;

  isConfigured(): boolean {
    try {
      assertTelnyxConfigured();
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
            provider: "telnyx",
            strategy: "inventory",
            status: "skipped",
            error: "Telnyx not configured",
          },
        ],
      };
    }

    return withProviderTiming("telnyx", "search_inventory", async () => {
      const inventory = await runTelnyxInventorySearches({
        areaCode: input.areaCode,
        keywordDigitStrings: input.keywordDigitStrings,
        memorablePatterns: input.memorablePatterns,
        baseLimit: input.baseLimit ?? 50,
        matchStyle: input.matchStyle ?? "both",
      });
      return {
        candidates: inventory.candidates.map(mapTelnyxRaw),
        attempts: inventory.attempts.map((a) => ({
          provider: "telnyx" as const,
          strategy: a.strategy,
          status: a.status,
          error: a.error,
          resultCount: a.resultCount,
        })),
      };
    }, input.areaCode);
  }

  async purchaseNumber(input: PurchaseNumberInput): Promise<PurchaseNumberResult> {
    return withProviderTiming("telnyx", "purchase_number", async () => {
      await ensureRegistrationRow(input.workspaceId);
      const reg = (await getRegistrationByWorkspace(input.workspaceId)) as MessagingRegistration;
      const bought = await getMessagingProvider().buyPhoneNumber(reg, input.e164);
      return {
        providerNumberId: bought.id,
        providerOrderId: bought.orderId ?? null,
        pending: bought.pending,
      };
    }, input.e164);
  }

  async checkAvailability(e164: string): Promise<boolean> {
    try {
      const res = await telnyxRequest<{
        data?: Array<{ phone_number?: string }>;
      }>("/available_phone_numbers", {
        query: {
          "filter[country_code]": "US",
          "filter[phone_number]": e164,
          "filter[limit]": 1,
        },
      });
      return Boolean(res.data?.some((n) => n.phone_number === e164));
    } catch {
      return false;
    }
  }

  async releaseNumber(providerNumberId: string, _workspaceId: string): Promise<void> {
    await withProviderTiming("telnyx", "release_number", async () => {
      await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
        method: "DELETE",
      });
    }, providerNumberId);
  }

  async configureVoiceWebhook(_providerNumberId: string, _workspaceId: string): Promise<void> {
    // Telnyx voice uses connection / dual-provision — unchanged from existing path.
  }
}

export const telnyxNumberProvider = new TelnyxNumberProvider();
