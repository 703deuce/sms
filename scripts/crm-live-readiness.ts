/**
 * CRM live-test readiness (presence-only — no secret values printed).
 * Prefer Salesforce for the current acceptance pass:
 *   npx tsx scripts/crm-live-readiness.ts
 *   npx tsx scripts/crm-live-readiness.ts salesforce
 */

import {
  checkCrmEnvironment,
  getCrmCallbackUrlForProvider,
} from "../src/lib/crm/env-check";
import { crmOAuthCallbackUrl } from "../src/lib/crm/oauth";
import { scopesForProvider, scopeDocumentation } from "../src/lib/crm/scopes";
import { CRM_JOB_TYPES } from "../src/lib/crm/runtime/job-types";
import { crmQueueName } from "../src/lib/crm/runtime/priority";
import type { CrmProviderId } from "../src/lib/crm/types";

function presence(name: string) {
  return Boolean(process.env[name]?.trim()) ? "SET" : "MISSING";
}

const focusArg = (process.argv[2] || "salesforce").toLowerCase();
const focusProviders: CrmProviderId[] =
  focusArg === "all"
    ? ["salesforce", "zoho", "pipedrive"]
    : focusArg === "zoho"
      ? ["zoho"]
      : focusArg === "pipedrive"
        ? ["pipedrive"]
        : ["salesforce"];

const shared = [
  "APP_URL",
  "INTEGRATION_SECRET_KEY",
  "DATABASE_URL",
  "CRM_WEBHOOK_SECRET",
  "QUEUE_DRIVER",
  "REDIS_URL",
  "CRON_SECRET",
] as const;

const byProvider: Record<CrmProviderId, readonly string[]> = {
  salesforce: [
    "SALESFORCE_CLIENT_ID",
    "SALESFORCE_CLIENT_SECRET",
    "SALESFORCE_WEBHOOK_SECRET",
  ],
  zoho: [
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_ACCOUNTS_DOMAIN",
    "ZOHO_WEBHOOK_SECRET",
  ],
  pipedrive: [
    "PIPEDRIVE_CLIENT_ID",
    "PIPEDRIVE_CLIENT_SECRET",
    "PIPEDRIVE_WEBHOOK_SECRET",
  ],
};

console.log(`=== CRM live readiness (${focusProviders.join(" + ")}) ===\n`);
console.log("Shared env presence:");
for (const k of shared) console.log(`  ${k}: ${presence(k)}`);

for (const provider of focusProviders) {
  console.log(`\n${provider} env presence:`);
  for (const k of byProvider[provider]) console.log(`  ${k}: ${presence(k)}`);
}

console.log("\nExact OAuth callback URLs (register these EXACTLY — no trailing slash):");
for (const provider of focusProviders) {
  console.log(`  ${provider}: ${getCrmCallbackUrlForProvider(provider)}`);
}
console.log("  Notes: APP_URL must have no trailing slash; callback path has no trailing slash.");
console.log("  Authorization + token exchange both send redirect_uri = that exact per-provider URL.");
if (process.env.APP_URL?.trim()) {
  for (const provider of focusProviders) {
    console.log(`  Code will send: ${crmOAuthCallbackUrl(provider)}`);
  }
}

if (focusProviders.includes("salesforce")) {
  console.log("\nSalesforce OAuth endpoints (from adapter):");
  console.log("  authorize: https://login.salesforce.com/services/oauth2/authorize");
  console.log("  token:     https://login.salesforce.com/services/oauth2/token");
  console.log("  API:       v59.0");
  console.log("  PKCE:      required (External Client App)");
  console.log("  login env: production login.salesforce.com (sandbox would need test.salesforce.com override — not currently configurable)");
}

console.log("\nScopes that will be requested:");
for (const provider of focusProviders) {
  console.log(`  ${provider}:`, scopesForProvider(provider).join(" "));
  for (const doc of scopeDocumentation(provider)) {
    console.log(`    - ${doc.scope}: ${doc.why}`);
  }
}

console.log("\nJob / queue coverage:");
console.log(
  "  Jobs drain inside the main web server (Next.js instrumentation / in-process poller).",
);
console.log("  There is no separate worker service in this deployment.");
console.log(
  "  Queues:",
  focusProviders.map((p) => crmQueueName(p)).join(", "),
);
console.log("  Job types:", CRM_JOB_TYPES.join(", "));
console.log("  Schema command: npm run db:push   (or npm run db:deploy when using migrate history)");
console.log(
  "  After Coolify env changes: redeploy/restart the main web application only (it already drains CRM jobs).",
);

const env = checkCrmEnvironment();
const focus = env.providers.filter((p) => focusProviders.includes(p.id));
console.log("\nOAuth ready flags:");
for (const p of focus) {
  console.log(
    `  ${p.id}: oauthReady=${p.oauthReady}${p.missing.length ? ` missing=[${p.missing.join(", ")}]` : ""}`,
  );
}

const requiredOk = env.items
  .filter(
    (i) =>
      i.required &&
      (i.provider === "shared" ||
        (i.provider && focusProviders.includes(i.provider as CrmProviderId))),
  )
  .every((i) => i.ok);

console.log(
  `\nOverall ${focusProviders.join("+")} required env: ${requiredOk ? "OK" : "NOT READY"}`,
);
if (!requiredOk) process.exitCode = 2;
