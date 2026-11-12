export type IntegrationCertMode = "LIVE" | "SANDBOX" | "SIMULATED" | "SKIPPED";

export type IntegrationConnectionMethod =
  | "oauth"
  | "api_key"
  | "webhook_credentials"
  | "app_credentials"
  | "none";

export type IntegrationCertCheckStatus = "PASS" | "FAIL" | "SKIP" | "NOT_TESTED";

export type IntegrationProviderKind = "crm" | "native";

export type CertProviderId =
  | "pipedrive"
  | "calendly"
  | "zoho"
  | "salesforce"
  | "jotform";

export type ProviderCertBucket =
  | "connected_live_account"
  | "sandbox_or_dev_account"
  | "fixture_only";

export type WorkspaceIntegrationView = {
  workspaceId: string;
  provider: CertProviderId;
  status: string;
  connectionMethod: IntegrationConnectionMethod;
  externalId: string | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasApiKeyInRecord: boolean;
  sandbox: boolean;
  meta: Record<string, unknown>;
};

export type ValidateConnectionResult = {
  ok: boolean;
  message: string;
  refreshed: boolean;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
};

export type FixtureCertResult = {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: string; message: string }>;
};

export type LiveCertResult = {
  apiTest: IntegrationCertCheckStatus;
  webhook: IntegrationCertCheckStatus;
  triggerE2E: IntegrationCertCheckStatus;
  acceptanceSummary?: Record<string, number>;
  detail?: string;
  createdExternalIds: string[];
};

export type ProviderCertReport = {
  provider: CertProviderId;
  displayName: string;
  bucket: ProviderCertBucket;
  connection: IntegrationConnectionMethod | "none";
  credential: "Valid" | "Invalid" | "Missing" | "Not tested";
  mode: IntegrationCertMode;
  fixture: FixtureCertResult;
  live?: LiveCertResult;
  notes: string[];
};

export type IntegrationCertReport = {
  certRunId: string;
  workspaceId: string;
  startedAt: string;
  finishedAt: string;
  providers: ProviderCertReport[];
};
