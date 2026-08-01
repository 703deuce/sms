import { getConnection } from "@/lib/integrations/connections";
import { refreshExternalAccessToken } from "./oauth";
import { getAdapter } from "./registry";
import { decryptIntegrationSecret } from "./secrets";
import { getIntegrationPreferences } from "./settings";
import type { AdapterContext, ExternalProviderId } from "./types";

export async function buildAdapterContext(
  workspaceId: string,
  provider: ExternalProviderId,
): Promise<AdapterContext> {
  const adapter = getAdapter(provider);
  let conn = await getConnection(workspaceId, provider);
  if (!conn) throw new Error(`${adapter.displayName} is not connected`);

  const meta = { ...((conn.configJson || {}) as Record<string, unknown>) };
  let accessToken = decryptIntegrationSecret(conn.accessToken) || "";

  if (adapter.authKind === "oauth") {
    const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
    if (expiresAt && expiresAt < Date.now() + 60_000 && conn.refreshToken) {
      accessToken = await refreshExternalAccessToken(workspaceId, provider);
      conn = await getConnection(workspaceId, provider);
    } else {
      accessToken = decryptIntegrationSecret(conn?.accessToken) || accessToken;
    }
  }

  if (!accessToken && provider !== "woocommerce") {
    // WooCommerce uses consumer key/secret from meta + accessToken(secret)
    throw new Error("Missing credentials — reconnect this integration");
  }

  // WooCommerce: decrypt consumer key from meta
  if (provider === "woocommerce" && typeof meta.consumerKey === "string") {
    meta.consumerKey = decryptIntegrationSecret(meta.consumerKey) || meta.consumerKey;
  }

  const preferences = await getIntegrationPreferences(workspaceId, provider);
  return {
    workspaceId,
    accessToken,
    refreshToken: decryptIntegrationSecret(conn?.refreshToken || null),
    meta,
    preferences,
  };
}
