/**
 * Probe live certification failures for ws_1 — diagnostic only.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/probe-integration-cert-failures.ts
 */
import { runCrmAcceptanceSuite } from "../src/lib/crm/acceptance";
import { runIntegrationAcceptance } from "../src/lib/integrations/framework/acceptance";
import { dispatchIntegrationAutomationEvent } from "../src/lib/integrations/framework/automation-bridge";
import { publishNormalizedEvent } from "../src/lib/integrations/framework/events";
import { getAdapter } from "../src/lib/integrations/framework/registry";
import { fixturesForProvider } from "../src/lib/integrations/certification/fixtures";
import { processCrmWebhookAutomation } from "../src/lib/crm/runtime/webhook-automation";

const WS = "ws_1";
const CERT = "cert_probe";

async function main() {
  console.log("=== CRM acceptance webhook-related items ===\n");
  for (const provider of ["pipedrive", "zoho"] as const) {
    const report = await runCrmAcceptanceSuite(WS, provider);
    const webhookItems = report.items.filter((i) => i.id.toLowerCase().includes("webhook"));
    console.log(provider, JSON.stringify(webhookItems, null, 2));
  }

  console.log("\n=== Calendly acceptance failures ===\n");
  const cal = await runIntegrationAcceptance(WS, "calendly");
  for (const item of cal.items) {
    if (item.status === "Failed and fixed" || item.status === "Code implemented but not live tested") {
      console.log(item.id, item.status, item.detail || item.title);
    }
  }

  console.log("\n=== Calendly fixture trigger E2E (direct dispatch) ===\n");
  const adapter = getAdapter("calendly");
  for (const fixture of fixturesForProvider("calendly", CERT)) {
    const events = await adapter.normalizeWebhook!(WS, fixture.payload);
    for (const ev of events) {
      const direct = await dispatchIntegrationAutomationEvent({
        workspaceId: WS,
        provider: "calendly",
        eventType: ev.eventType,
        phone: ev.phone || null,
        email: ev.email || null,
        payload: ev.payload,
      });
      const published = await publishNormalizedEvent(ev);
      console.log(fixture.id, {
        eventType: ev.eventType,
        phone: ev.phone,
        email: ev.email,
        directDispatch: direct,
        publish: { published: published.published, contactId: published.contactId, reason: (published as { reason?: string }).reason },
      });
    }
  }

  console.log("\n=== CRM fixture webhook ingest ===\n");
  for (const provider of ["pipedrive", "zoho"] as const) {
    for (const fixture of fixturesForProvider(provider, CERT)) {
      const result = await processCrmWebhookAutomation({
        workspaceId: WS,
        provider,
        eventType: fixture.eventType || fixture.id,
        payload: fixture.payload,
      });
      console.log(provider, fixture.id, result);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
