/**
 * Register provider webhooks after OAuth connect or when a flow needs them.
 */

import { randomBytes } from "crypto";
import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { buildAdapterContext } from "./context";
import { externalWebhookUrl } from "./app-url";
import { getAdapter } from "./registry";
import { writeIntegrationAudit } from "./audit";
import type { ExternalProviderId } from "./types";

export type RegisterWebhooksResult = {
  ok: boolean;
  provider: string;
  subscriptionIds: string[];
  callbackUrl: string | null;
  error?: string;
};

export async function ensureProviderWebhooksRegistered(
  workspaceId: string,
  provider: ExternalProviderId,
  opts?: { scope?: "user" | "organization" },
): Promise<RegisterWebhooksResult> {
  const adapter = getAdapter(provider);
  if (!adapter.registerWebhooks) {
    return {
      ok: true,
      provider,
      subscriptionIds: [],
      callbackUrl: null,
    };
  }

  const conn = await getConnection(workspaceId, provider);
  if (!conn || conn.status !== "connected") {
    return {
      ok: false,
      provider,
      subscriptionIds: [],
      callbackUrl: null,
      error: `${provider} is not connected`,
    };
  }

  const cfg = (conn.configJson || {}) as Record<string, unknown>;
  let token =
    typeof cfg.webhookToken === "string" && cfg.webhookToken.trim()
      ? cfg.webhookToken.trim()
      : "";
  if (!token) {
    token = randomBytes(24).toString("hex");
    await upsertConnection({
      workspaceId,
      provider,
      config: { webhookToken: token },
      mergeConfig: true,
    });
  }

  const callbackUrl = externalWebhookUrl(provider, token);
  const ctx = await buildAdapterContext(workspaceId, provider);

  try {
    if (provider === "calendly") {
      const { cleanupTransovoWebhookSubscriptions } = await import(
        "../adapters/calendly-actions"
      );
      await cleanupTransovoWebhookSubscriptions(ctx, null).catch(() => undefined);
    } else {
      const priorIds = Array.isArray(cfg.webhookSubscriptionIds)
        ? (cfg.webhookSubscriptionIds as string[])
        : [];
      if (adapter.removeWebhooks && priorIds.length) {
        await adapter.removeWebhooks(ctx, priorIds).catch(() => undefined);
      }
    }

    const registered = await adapter.registerWebhooks(ctx, callbackUrl, {
      scope: opts?.scope,
    });

    const nextConfig: Record<string, unknown> = {
      webhookSubscriptionIds: registered.ids || [],
      webhookCallbackUrl: callbackUrl,
      webhookSubscriptionScope: registered.scope || opts?.scope || null,
      webhookSetupError: null,
      webhookRegisteredAt: new Date().toISOString(),
    };
    if (registered.signingKey) {
      nextConfig.signingKey = registered.signingKey;
      nextConfig.signingKeySource = "subscription_create";
      nextConfig.signingKeyCapturedAt = new Date().toISOString();
    } else if (provider === "calendly") {
      nextConfig.signingKey = null;
      nextConfig.signingKeySource = "oauth_app_env";
      nextConfig.signingKeyCapturedAt = new Date().toISOString();
    }

    await upsertConnection({
      workspaceId,
      provider,
      config: nextConfig,
      mergeConfig: true,
    });

    await writeIntegrationAudit({
      workspaceId,
      provider,
      category: "webhook",
      action: "registered",
      message: `Webhooks registered for ${adapter.displayName}`,
      detail: { callbackUrl, ids: registered.ids },
    });

    return {
      ok: true,
      provider,
      subscriptionIds: registered.ids || [],
      callbackUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertConnection({
      workspaceId,
      provider,
      config: { webhookSetupError: message },
      mergeConfig: true,
    });
    return {
      ok: false,
      provider,
      subscriptionIds: [],
      callbackUrl,
      error: message,
    };
  }
}
