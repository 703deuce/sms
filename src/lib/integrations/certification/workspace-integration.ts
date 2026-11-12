import { getConnection } from "@/lib/integrations/connections";
import { decryptIntegrationSecret } from "@/lib/integrations/framework/secrets";
import { getAdapter } from "@/lib/integrations/framework/registry";
import type { ExternalProviderId } from "@/lib/integrations/framework/types";
import type { CrmProviderId } from "@/lib/crm/types";
import { PROVIDER_CATALOG } from "./provider-catalog";
import type {
  CertProviderId,
  IntegrationConnectionMethod,
  WorkspaceIntegrationView,
} from "./types";

export type GetWorkspaceIntegrationInput = {
  workspaceId: string;
  provider: CertProviderId;
};

function detectConnectionMethod(
  provider: CertProviderId,
  row: {
    accessToken: string | null;
    refreshToken: string | null;
    configJson: unknown;
  },
): IntegrationConnectionMethod {
  const meta = (row.configJson || {}) as Record<string, unknown>;
  const entry = PROVIDER_CATALOG[provider];

  if (entry.kind === "crm") {
    if (row.refreshToken || row.accessToken) return "oauth";
    return "none";
  }

  try {
    const adapter = getAdapter(provider as ExternalProviderId);
    if (adapter.authKind === "oauth") return "oauth";
    if (adapter.authKind === "credentials") {
      if (meta.apiKey || row.accessToken) return "api_key";
      return "app_credentials";
    }
  } catch {
    // fall through
  }

  if (meta.webhookToken || meta.signingKey) return "webhook_credentials";
  if (row.accessToken) return "api_key";
  return "none";
}

/**
 * Load workspace-scoped integration connection from the database (not .env).
 * This is the canonical source for certification credentials.
 */
export async function getWorkspaceIntegration(
  input: GetWorkspaceIntegrationInput,
): Promise<WorkspaceIntegrationView | null> {
  const row = await getConnection(input.workspaceId, input.provider);
  if (!row) return null;

  const meta = (row.configJson || {}) as Record<string, unknown>;
  const access = decryptIntegrationSecret(row.accessToken);
  const refresh = decryptIntegrationSecret(row.refreshToken);
  const apiKeyInMeta =
    typeof meta.apiKey === "string"
      ? Boolean(decryptIntegrationSecret(meta.apiKey) || meta.apiKey)
      : false;

  const sandbox =
    meta.sandbox === true ||
    meta.isSandbox === true ||
    String(meta.environment || "").toLowerCase() === "sandbox" ||
    process.env.INTEGRATIONS_OAUTH_SANDBOX === "1";

  return {
    workspaceId: input.workspaceId,
    provider: input.provider,
    status: String(row.status || "disconnected"),
    connectionMethod: detectConnectionMethod(input.provider, row),
    externalId: row.externalId,
    hasAccessToken: Boolean(access),
    hasRefreshToken: Boolean(refresh),
    hasApiKeyInRecord: apiKeyInMeta || Boolean(access),
    sandbox,
    meta,
  };
}

export function isWorkspaceIntegrationConnected(view: WorkspaceIntegrationView | null): boolean {
  if (!view) return false;
  if (view.status !== "connected") return false;
  if (view.connectionMethod === "oauth") {
    return view.hasAccessToken;
  }
  if (view.connectionMethod === "api_key" || view.connectionMethod === "app_credentials") {
    return view.hasApiKeyInRecord || view.hasAccessToken;
  }
  return view.hasAccessToken;
}

export function asCrmProviderId(provider: CertProviderId): CrmProviderId | null {
  if (provider === "pipedrive" || provider === "zoho" || provider === "salesforce") {
    return provider;
  }
  return null;
}

export function asNativeProviderId(provider: CertProviderId): ExternalProviderId | null {
  if (provider === "calendly" || provider === "jotform") return provider;
  return null;
}
