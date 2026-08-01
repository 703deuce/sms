/**
 * Zoho CRM + Pipedrive live-test readiness (no secret values printed).
 * Run on the Coolify / DB-capable host:
 *   npx tsx scripts/crm-live-readiness.ts
 */

import { checkCrmEnvironment, getCrmCallbackUrl } from "../src/lib/crm/env-check";
import { resolveZohoAccountsServer } from "../src/lib/crm/oauth";
import { scopesForProvider } from "../src/lib/crm/scopes";
import { crmQueueName } from "../src/lib/crm/runtime/priority";

function presence(name: string) {
  return Boolean(process.env[name]?.trim()) ? "SET" : "MISSING";
}

const shared = [
  "APP_URL",
  "INTEGRATION_SECRET_KEY",
  "DATABASE_URL",
  "CRM_WEBHOOK_SECRET",
  "QUEUE_DRIVER",
  "REDIS_URL",
  "CRON_SECRET",
] as const;

const zoho = [
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_ACCOUNTS_DOMAIN",
  "ZOHO_WEBHOOK_SECRET",
] as const;

const pipedrive = [
  "PIPEDRIVE_CLIENT_ID",
  "PIPEDRIVE_CLIENT_SECRET",
  "PIPEDRIVE_WEBHOOK_SECRET",
] as const;

console.log("=== CRM live readiness (Zoho CRM + Pipedrive) ===\n");
console.log("Shared env presence:");
for (const k of shared) console.log(`  ${k}: ${presence(k)}`);
console.log("\nZoho CRM env presence:");
for (const k of zoho) console.log(`  ${k}: ${presence(k)}`);
console.log("\nPipedrive env presence:");
for (const k of pipedrive) console.log(`  ${k}: ${presence(k)}`);

const callback = getCrmCallbackUrl();
console.log("\nExact OAuth callback URL (register this EXACTLY in both consoles):");
console.log(`  ${callback}`);
console.log("  Notes: APP_URL must have no trailing slash; callback path has no trailing slash.");
console.log("  Authorization + token exchange both send redirect_uri = that exact URL.");

console.log("\nZoho Accounts host resolution (token exchange):");
console.log(`  default/US: ${resolveZohoAccountsServer({})}`);
console.log(`  EU example: ${resolveZohoAccountsServer({ location: "eu" })}`);
console.log(
  `  override env: ${process.env.ZOHO_ACCOUNTS_DOMAIN?.trim() ? "active" : "inactive (use callback accounts-server)"}`,
);

console.log("\nScopes that will be requested:");
console.log("  Zoho CRM:", scopesForProvider("zoho").join(" "));
console.log("  Pipedrive:", scopesForProvider("pipedrive").join(" "));

console.log("\nWorker / queue coverage:");
console.log("  Process: npm run worker:all  (single consumer drains all queues)");
console.log("  Queues:", ["zoho", "pipedrive"].map((p) => crmQueueName(p)).join(", "));
console.log(
  "  Job types: crm_sync, crm_push_event, crm_metadata_refresh, crm_bulk_sync, crm_webhook_process, crm_scheduled_incremental",
);
console.log("  Schema command: npm run db:push   (or supabase/crm-integration.sql fallback)");

const env = checkCrmEnvironment();
const focus = env.providers.filter((p) => p.id === "zoho" || p.id === "pipedrive");
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
      (i.provider === "shared" || i.provider === "zoho" || i.provider === "pipedrive"),
  )
  .every((i) => i.ok);

console.log(`\nOverall Zoho+Pipedrive required env: ${requiredOk ? "OK" : "NOT READY"}`);
if (!requiredOk) process.exitCode = 2;
