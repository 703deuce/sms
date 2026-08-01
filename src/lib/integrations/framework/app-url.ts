/**
 * Authoritative public origin for OAuth callbacks and webhook URLs.
 * Prefer APP_URL; fall back to NEXT_PUBLIC_APP_URL for local/dev parity.
 */

export function getIntegrationAppUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function externalOAuthCallbackUrl(provider: string): string {
  return `${getIntegrationAppUrl()}/api/integrations/native/${provider}/callback`;
}

export function externalWebhookUrl(provider: string, token?: string | null): string {
  const base = `${getIntegrationAppUrl()}/api/integrations/native/webhooks/${provider}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export type IntegrationEnvHealth = {
  appUrl: { status: "configured" | "missing" | "invalid_format"; value?: string };
  encryptionKey: { status: "configured" | "missing" | "invalid_format" };
  database: { status: "configured" | "missing" };
  productionHttps: { status: "ok" | "invalid_format" | "n/a" };
  oauth: Record<string, { status: "configured" | "missing"; callbackUrl: string }>;
};

/** Never includes secret values — only configured/missing/invalid. */
export function getIntegrationEnvHealth(): IntegrationEnvHealth {
  const appUrl = getIntegrationAppUrl();
  const hasApp =
    Boolean(process.env.APP_URL?.trim()) || Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
  const key = process.env.INTEGRATION_SECRET_KEY?.trim() || "";
  const isProd = process.env.NODE_ENV === "production";

  const oauthProviders = [
    {
      id: "calendly",
      clientId: "CALENDLY_CLIENT_ID",
      clientSecret: "CALENDLY_CLIENT_SECRET",
    },
    {
      id: "mailchimp",
      clientId: "MAILCHIMP_CLIENT_ID",
      clientSecret: "MAILCHIMP_CLIENT_SECRET",
    },
    {
      id: "typeform",
      clientId: "TYPEFORM_CLIENT_ID",
      clientSecret: "TYPEFORM_CLIENT_SECRET",
    },
  ] as const;

  const oauth: IntegrationEnvHealth["oauth"] = {};
  for (const p of oauthProviders) {
    const ready =
      Boolean(process.env[p.clientId]?.trim()) && Boolean(process.env[p.clientSecret]?.trim());
    oauth[p.id] = {
      status: ready ? "configured" : "missing",
      callbackUrl: externalOAuthCallbackUrl(p.id),
    };
  }

  return {
    appUrl: {
      status: !hasApp ? "missing" : /^https?:\/\//i.test(appUrl) ? "configured" : "invalid_format",
      value: appUrl,
    },
    encryptionKey: {
      status: !key ? "missing" : key.length < 16 ? "invalid_format" : "configured",
    },
    database: {
      status: process.env.DATABASE_URL?.trim() ? "configured" : "missing",
    },
    productionHttps: {
      status: !isProd ? "n/a" : appUrl.startsWith("https://") ? "ok" : "invalid_format",
    },
    oauth,
  };
}

export function assertIntegrationRuntimeReady(opts?: { requireOauth?: string[] }) {
  const health = getIntegrationEnvHealth();
  const errors: string[] = [];
  if (health.appUrl.status !== "configured") {
    errors.push("APP_URL (or NEXT_PUBLIC_APP_URL) is missing or invalid");
  }
  if (health.productionHttps.status === "invalid_format") {
    errors.push("APP_URL must be HTTPS in production");
  }
  if (health.encryptionKey.status !== "configured") {
    errors.push("INTEGRATION_SECRET_KEY is missing or too short");
  }
  for (const id of opts?.requireOauth || []) {
    if (health.oauth[id]?.status === "missing") {
      errors.push(`${id} OAuth client credentials are not configured`);
    }
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    (err as Error & { code: string }).code = "INTEGRATION_ENV_INVALID";
    throw err;
  }
  return health;
}
