import { upsertConnection } from "@/lib/integrations/connections";
import { writeIntegrationAudit } from "./audit";
import { getAdapter } from "./registry";
import { encryptIntegrationSecret } from "./secrets";
import type { ExternalProviderId } from "./types";

/**
 * Connect a customer-supplied credential provider.
 * Validates before saving; encrypts secrets; never returns secrets to the client.
 */
export async function connectWithCredentials(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  credentials: Record<string, string>;
  actorUserId?: string | null;
}) {
  const adapter = getAdapter(input.provider);
  if (adapter.authKind !== "credentials") {
    throw new Error(`${input.provider} uses OAuth, not API credentials`);
  }

  const fields = adapter.credentialFields || [];
  for (const field of fields) {
    if (field.required !== false && !input.credentials[field.key]?.trim()) {
      throw new Error(`${field.label} is required`);
    }
  }

  // Build a temporary context for validation without persisting plaintext secrets.
  const meta: Record<string, unknown> = { authKind: "credentials" };
  let accessToken = "";

  switch (input.provider) {
    case "activecampaign": {
      const apiUrl = input.credentials.apiUrl.trim().replace(/\/$/, "");
      const apiKey = input.credentials.apiKey.trim();
      meta.apiUrl = apiUrl;
      accessToken = apiKey;
      break;
    }
    case "woocommerce": {
      const storeUrl = input.credentials.storeUrl.trim().replace(/\/$/, "");
      if (!storeUrl.startsWith("https://") && process.env.NODE_ENV === "production") {
        throw new Error("WooCommerce store URL must use HTTPS in production");
      }
      meta.storeUrl = storeUrl;
      meta.consumerKey = encryptIntegrationSecret(input.credentials.consumerKey.trim());
      // accessToken holds consumer secret encrypted; consumer key in config
      accessToken = input.credentials.consumerSecret.trim();
      break;
    }
    case "jotform": {
      accessToken = input.credentials.apiKey.trim();
      if (input.credentials.apiBase?.trim()) {
        meta.apiBase = input.credentials.apiBase.trim().replace(/\/$/, "");
      }
      break;
    }
    case "close": {
      accessToken = input.credentials.apiKey.trim();
      break;
    }
    case "freshdesk": {
      meta.subdomain = input.credentials.subdomain.trim().replace(/\.freshdesk\.com$/i, "");
      accessToken = input.credentials.apiKey.trim();
      break;
    }
    case "klaviyo": {
      accessToken = input.credentials.apiKey.trim();
      break;
    }
    case "highlevel": {
      accessToken = input.credentials.privateToken.trim();
      meta.locationId = input.credentials.locationId.trim();
      if (input.credentials.agencyId?.trim()) {
        meta.agencyId = input.credentials.agencyId.trim();
      }
      meta.connectionLabel = "Private token connection — specific account/location only";
      break;
    }
    default:
      throw new Error(`Unsupported credential provider: ${input.provider}`);
  }

  // Persist pending then validate
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    status: "pending_oauth",
    accessToken: encryptIntegrationSecret(accessToken),
    refreshToken: null,
    config: meta,
    mergeConfig: false,
    lastError: null,
  });

  const { buildAdapterContext } = await import("./context");
  const ctx = await buildAdapterContext(input.workspaceId, input.provider);
  const health = await adapter.validateConnection(ctx);
  if (!health.ok) {
    await upsertConnection({
      workspaceId: input.workspaceId,
      provider: input.provider,
      status: "error",
      accessToken: null,
      lastError: health.message || "Credential validation failed",
      config: { authKind: "credentials" },
    });
    throw new Error(health.message || "Credential validation failed");
  }

  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    status: "connected",
    externalId: health.accountId || null,
    connectedAccountName: health.accountName || null,
    accessToken: encryptIntegrationSecret(accessToken),
    config: {
      ...meta,
      capabilities: health.capabilities || [],
      scopesGranted: health.scopes || [],
      lastValidatedAt: new Date().toISOString(),
      // Never store plaintext secrets in config
      apiKey: undefined,
      privateToken: undefined,
      consumerSecret: undefined,
    },
    mergeConfig: true,
    lastError: null,
    syncStatus: "idle",
  });

  await writeIntegrationAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "oauth",
    action: "credentials_connect",
    message: `Connected ${adapter.displayName} with customer credentials`,
    detail: { accountId: health.accountId, accountName: health.accountName },
    actorUserId: input.actorUserId,
  });

  const { enqueueIntegrationSync } = await import("./sync");
  await enqueueIntegrationSync({
    workspaceId: input.workspaceId,
    provider: input.provider,
    kind: "initial",
  });

  return { health };
}

export async function rotateCredentials(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  credentials: Record<string, string>;
  actorUserId?: string | null;
}) {
  const result = await connectWithCredentials(input);
  await writeIntegrationAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "oauth",
    action: "credentials_rotate",
    message: "Credentials rotated",
    actorUserId: input.actorUserId,
  });
  return result;
}
