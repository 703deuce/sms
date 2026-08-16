/**
 * Upstream number + voice providers (Telnyx, Twilio).
 * Application features stay provider-agnostic; adapters own carrier API details.
 */

export type NumberUpstreamProvider = "telnyx" | "twilio";

export type NumberCapabilities = {
  voice: boolean;
  sms: boolean;
  mms: boolean;
};

export type NormalizedNumberCandidate = {
  e164: string;
  nationalNumber: string;
  provider: NumberUpstreamProvider;
  providerReference: string | null;
  monthlyCost: string | null;
  upfrontCost: string | null;
  currency: string | null;
  locality: string | null;
  region: string | null;
  rateCenter: string | null;
  capabilities: NumberCapabilities;
  vanityFormat?: string | null;
  raw: Record<string, unknown>;
};

export type InventorySearchInput = {
  areaCode: string;
  keywordDigitStrings: string[];
  memorablePatterns: string[];
  baseLimit?: number;
  matchStyle?: "ends_with" | "contains" | "both";
};

export type ProviderSearchAttempt = {
  provider: NumberUpstreamProvider;
  strategy: string;
  status: "ok" | "error" | "unsupported" | "timeout" | "skipped";
  error?: string;
  resultCount?: number;
};

export type InventorySearchResult = {
  candidates: NormalizedNumberCandidate[];
  attempts: ProviderSearchAttempt[];
};

export type PurchaseNumberInput = {
  workspaceId: string;
  e164: string;
  customerReference?: string;
};

export type PurchaseNumberResult = {
  providerNumberId: string;
  providerOrderId?: string | null;
  pending?: boolean;
};

export interface NumberProvider {
  readonly id: NumberUpstreamProvider;
  isConfigured(): boolean;
  searchInventory(input: InventorySearchInput): Promise<InventorySearchResult>;
  purchaseNumber(input: PurchaseNumberInput): Promise<PurchaseNumberResult>;
  checkAvailability(e164: string): Promise<boolean>;
  releaseNumber(providerNumberId: string, workspaceId: string): Promise<void>;
  configureVoiceWebhook(providerNumberId: string, workspaceId: string): Promise<void>;
}

export type ProviderOperationLog = {
  provider: NumberUpstreamProvider;
  operation: string;
  number?: string;
  providerRequestId?: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
};
