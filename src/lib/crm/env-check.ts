/**
 * Environment validation for CRM production readiness.
 * Missing vars must produce helpful, actionable errors — never silent failure.
 */

import { CRM_PROVIDER_IDS, getConnector, providerEnvReady } from "./registry";
import type { CrmProviderId } from "./types";
import { scopesForProvider } from "./scopes";

export type EnvCheckItem = {
  key: string;
  ok: boolean;
  required: boolean;
  message: string;
  provider?: CrmProviderId | "shared";
};

export type EnvCheckResult = {
  ok: boolean;
  callbackUrl: string;
  items: EnvCheckItem[];
  providers: Array<{
    id: CrmProviderId;
    name: string;
    oauthReady: boolean;
    missing: string[];
    scopes: string[];
  }>;
};

function appUrl() {
  return (process.env.APP_URL || "").replace(/\/$/, "");
}

export function getCrmCallbackUrl() {
  const base = appUrl();
  if (!base) return "/api/crm/oauth/callback (set APP_URL)";
  return `${base}/api/crm/oauth/callback`;
}

export function checkCrmEnvironment(provider?: CrmProviderId): EnvCheckResult {
  const items: EnvCheckItem[] = [];
  const base = appUrl();

  items.push({
    key: "APP_URL",
    required: true,
    ok: Boolean(base),
    provider: "shared",
    message: base
      ? `APP_URL is set (${base}). Callback must be registered exactly as ${base}/api/crm/oauth/callback`
      : "APP_URL is missing. Set it to your public site origin (no trailing slash), e.g. https://app.transovo.com",
  });

  items.push({
    key: "INTEGRATION_SECRET_KEY",
    required: true,
    ok: Boolean(process.env.INTEGRATION_SECRET_KEY?.trim()),
    provider: "shared",
    message: process.env.INTEGRATION_SECRET_KEY?.trim()
      ? "INTEGRATION_SECRET_KEY is set (OAuth state HMAC + CRM token encryption)"
      : "INTEGRATION_SECRET_KEY is missing. Generate a long random secret for OAuth state signing and token encryption.",
  });

  items.push({
    key: "DATABASE_URL",
    required: true,
    ok: Boolean(process.env.DATABASE_URL?.trim()),
    provider: "shared",
    message: process.env.DATABASE_URL?.trim()
      ? "DATABASE_URL is set"
      : "DATABASE_URL is missing. CRM tables require Prisma db:push against Postgres.",
  });

  items.push({
    key: "CRM_WEBHOOK_SECRET",
    required: false,
    ok: Boolean(process.env.CRM_WEBHOOK_SECRET?.trim()),
    provider: "shared",
    message: process.env.CRM_WEBHOOK_SECRET?.trim()
      ? "CRM_WEBHOOK_SECRET is set (shared inbound webhook HMAC)"
      : "CRM_WEBHOOK_SECRET optional — set for signed inbound CRM webhooks",
  });

  const ids = provider ? [provider] : [...CRM_PROVIDER_IDS];
  const providers = ids.map((id) => {
    const c = getConnector(id);
    const missing: string[] = [];
    if (!process.env[c.oauth.clientIdEnv]?.trim()) missing.push(c.oauth.clientIdEnv);
    if (!process.env[c.oauth.clientSecretEnv]?.trim()) missing.push(c.oauth.clientSecretEnv);

    items.push({
      key: c.oauth.clientIdEnv,
      required: true,
      ok: !missing.includes(c.oauth.clientIdEnv),
      provider: id,
      message: missing.includes(c.oauth.clientIdEnv)
        ? `${c.oauth.clientIdEnv} missing — create the ${c.displayName} OAuth app and paste the client id`
        : `${c.oauth.clientIdEnv} is set`,
    });
    items.push({
      key: c.oauth.clientSecretEnv,
      required: true,
      ok: !missing.includes(c.oauth.clientSecretEnv),
      provider: id,
      message: missing.includes(c.oauth.clientSecretEnv)
        ? `${c.oauth.clientSecretEnv} missing — paste the client secret from the ${c.displayName} OAuth app`
        : `${c.oauth.clientSecretEnv} is set`,
    });

    if (id === "zoho") {
      items.push({
        key: "ZOHO_ACCOUNTS_DOMAIN",
        required: false,
        ok: true,
        provider: id,
        message: process.env.ZOHO_ACCOUNTS_DOMAIN?.trim()
          ? `ZOHO_ACCOUNTS_DOMAIN override set — token exchange forced to that host`
          : "ZOHO_ACCOUNTS_DOMAIN unset — regional Accounts host taken from OAuth callback (accounts-server / location)",
      });
      items.push({
        key: "ZOHO_WEBHOOK_SECRET",
        required: false,
        ok: Boolean(process.env.ZOHO_WEBHOOK_SECRET?.trim()),
        provider: id,
        message: process.env.ZOHO_WEBHOOK_SECRET?.trim()
          ? "ZOHO_WEBHOOK_SECRET is set"
          : "ZOHO_WEBHOOK_SECRET optional",
      });
    }
    if (id === "pipedrive") {
      items.push({
        key: "PIPEDRIVE_WEBHOOK_SECRET",
        required: false,
        ok: Boolean(process.env.PIPEDRIVE_WEBHOOK_SECRET?.trim()),
        provider: id,
        message: process.env.PIPEDRIVE_WEBHOOK_SECRET?.trim()
          ? "PIPEDRIVE_WEBHOOK_SECRET is set"
          : "PIPEDRIVE_WEBHOOK_SECRET optional",
      });
    }

    return {
      id,
      name: c.displayName,
      oauthReady: providerEnvReady(id) && Boolean(base),
      missing: [
        ...missing,
        ...(!base ? ["APP_URL"] : []),
        ...(!process.env.INTEGRATION_SECRET_KEY?.trim() ? ["INTEGRATION_SECRET_KEY"] : []),
      ],
      scopes: scopesForProvider(id),
    };
  });

  const ok = items.filter((i) => i.required).every((i) => i.ok);
  return { ok, callbackUrl: getCrmCallbackUrl(), items, providers };
}

/** Throw a human-readable error when starting OAuth without env. */
export function assertCrmOAuthEnv(provider: CrmProviderId) {
  const check = checkCrmEnvironment(provider);
  const providerRow = check.providers[0];
  if (!check.items.find((i) => i.key === "APP_URL")?.ok) {
    throw new Error(
      "Transovo isn’t configured for CRM connections yet (missing APP_URL). Ask your admin to set the public app URL.",
    );
  }
  if (providerRow && !providerRow.oauthReady) {
    throw new Error(
      `${providerRow.name} isn’t ready to connect. Missing: ${providerRow.missing.join(", ")}. See Integrations → CRM → Diagnostics.`,
    );
  }
}
