import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import {
  disconnectConnection,
  getConnection,
  isStripeEnvConfigured,
  listConnections,
  upsertConnection,
} from "@/lib/integrations/connections";
import { getGoogleIntegrationStartUrl } from "@/lib/integrations/oauth";
import { syncProvider } from "@/lib/integrations/sync";

const WEBHOOK_PROVIDERS = ["hubspot", "salesforce", "shopify", "calendly"];

function webhookUrl(provider: string, token: string) {
  return `${getAppBaseUrl()}/api/integrations/${provider}/webhook?token=${token}`;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const connections = await listConnections(auth.workspaceId);
    return NextResponse.json({
      data: { connections, stripeEnvConfigured: isStripeEnvConfigured() },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      action?: "connect" | "disconnect" | "sync" | "oauth";
      config?: Record<string, string>;
    };
    const provider = body.provider?.trim();
    const action = body.action || "connect";
    if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

    if (action === "oauth") {
      const redirectUrl = getGoogleIntegrationStartUrl(auth.workspaceId, provider);
      return NextResponse.json({ data: { redirectUrl } });
    }

    if (action === "disconnect") {
      await disconnectConnection(auth.workspaceId, provider);
      return NextResponse.json({ data: { ok: true } });
    }

    if (action === "sync") {
      const result = await syncProvider(auth.workspaceId, provider);
      return NextResponse.json({ data: result });
    }

    // action === "connect" — save credentials / config
    const config = body.config || {};
    const existing = await getConnection(auth.workspaceId, provider);
    const existingConfig = (existing?.configJson || {}) as Record<string, unknown>;
    let webhookToken = existingConfig.webhookToken as string | undefined;
    if (WEBHOOK_PROVIDERS.includes(provider) && !webhookToken) {
      webhookToken = randomBytes(20).toString("hex");
    }

    const newConfig: Record<string, unknown> = { ...existingConfig };
    let accessToken: string | undefined;

    switch (provider) {
      case "hubspot":
        if (!config.apiKey?.trim()) throw new Error("HubSpot private app token required");
        accessToken = config.apiKey.trim();
        break;
      case "shopify":
        if (!config.shopDomain?.trim() || !config.accessToken?.trim()) {
          throw new Error("Shopify shop domain and Admin API token required");
        }
        accessToken = config.accessToken.trim();
        newConfig.shopDomain = config.shopDomain.trim();
        break;
      case "salesforce":
        if (!config.instanceUrl?.trim() || !config.accessToken?.trim()) {
          throw new Error("Salesforce instance URL and access token required");
        }
        accessToken = config.accessToken.trim();
        newConfig.instanceUrl = config.instanceUrl.trim();
        break;
      case "calendly":
        if (config.signingKey?.trim()) newConfig.signingKey = config.signingKey.trim();
        break;
      default:
        throw new Error(`Provider ${provider} cannot be connected with an API key`);
    }

    if (webhookToken) newConfig.webhookToken = webhookToken;

    await upsertConnection({
      workspaceId: auth.workspaceId,
      provider,
      status: "connected",
      accessToken: accessToken ?? existing?.accessToken ?? null,
      config: newConfig,
    });

    return NextResponse.json({
      data: {
        ok: true,
        webhookUrl: webhookToken ? webhookUrl(provider, webhookToken) : undefined,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
