/**
 * Ensure integration webhooks are registered when flows that need them are published.
 */

import { parseAutomationDefinition } from "./types";
import { getPrisma } from "@/lib/db";
import { isExternalProvider } from "@/lib/integrations/framework/registry";
import { ensureProviderWebhooksRegistered } from "@/lib/integrations/framework/register-webhooks";
import type { ExternalProviderId } from "@/lib/integrations/framework/types";

const NATIVE_WEBHOOK_PROVIDERS = new Set([
  "calendly",
  "woocommerce",
  "typeform",
  "jotform",
  "mailchimp",
  "klaviyo",
  "activecampaign",
  "close",
  "highlevel",
  "freshdesk",
]);

const CRM_PROVIDERS = new Set(["salesforce", "zoho", "pipedrive"]);

export function providersReferencedInDefinition(definition: unknown): Set<string> {
  const def = parseAutomationDefinition(definition);
  const providers = new Set<string>();
  for (const node of def.nodes) {
    const cfg = node.data.config || {};
    const block = node.data.blockType;
    const explicit = String(cfg.provider || "").trim();
    if (explicit) providers.add(explicit);
    if (block.startsWith("integration_")) {
      if (block.includes("appointment") || block.includes("event_type")) {
        providers.add("calendly");
      }
      if (block.includes("order")) providers.add("woocommerce");
      if (block.includes("ticket")) providers.add("freshdesk");
      if (block.includes("form_submitted")) {
        providers.add("typeform");
        providers.add("jotform");
      }
      if (block.includes("list_joined") || block.includes("consent")) {
        providers.add("activecampaign");
        providers.add("klaviyo");
        providers.add("mailchimp");
      }
      if (
        block.includes("contact_") ||
        block.includes("lead_") ||
        block.includes("company_") ||
        block.includes("deal_") ||
        block.includes("task_") ||
        block.includes("activity_") ||
        block.includes("note_") ||
        block.includes("call_activity")
      ) {
        providers.add("salesforce");
        providers.add("zoho");
        providers.add("pipedrive");
      }
    }
    if (block === "integration_action") {
      const actionId = String(cfg.actionId || "");
      const params = cfg.params as Record<string, unknown> | undefined;
      if (params?.provider) providers.add(String(params.provider));
      if (actionId.includes("appointment")) providers.add("calendly");
    }
  }
  return providers;
}

export type IntegrationSubscriptionResult = {
  provider: string;
  ok: boolean;
  registered: boolean;
  message: string;
};

export async function ensureIntegrationSubscriptionsForFlow(
  workspaceId: string,
  definition: unknown,
): Promise<IntegrationSubscriptionResult[]> {
  const def = parseAutomationDefinition(definition);
  const providers = providersReferencedInDefinition(definition);
  const results: IntegrationSubscriptionResult[] = [];

  const trigger = def.nodes.find((n) => n.type === "trigger");
  const explicitProvider = trigger
    ? String(trigger.data.config?.provider || "").trim()
    : "";

  for (const provider of providers) {
    if (NATIVE_WEBHOOK_PROVIDERS.has(provider) && isExternalProvider(provider)) {
      const reg = await ensureProviderWebhooksRegistered(
        workspaceId,
        provider as ExternalProviderId,
      );
      results.push({
        provider,
        ok: reg.ok || Boolean(reg.error?.includes("plan")),
        registered: reg.subscriptionIds.length > 0,
        message:
          reg.error ||
          (reg.subscriptionIds.length
            ? "Webhooks registered"
            : "Webhook registration skipped or unavailable on plan"),
      });
      continue;
    }

    if (CRM_PROVIDERS.has(provider)) {
      const conn = await getPrisma().integrationConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider } },
        select: { status: true },
      });
      const connected = conn?.status === "connected";
      const required = explicitProvider === provider;
      results.push({
        provider,
        ok: connected || !required,
        registered: connected,
        message: connected
          ? "CRM connected — triggers fire on webhook or sync"
          : required
            ? `Connect ${provider} in Integrations before activating this flow`
            : `${provider} not connected (optional filter)`,
      });
    }
  }

  return results;
}

export async function listConnectedProviders(workspaceId: string): Promise<string[]> {
  const rows = await getPrisma().integrationConnection.findMany({
    where: { workspaceId, status: "connected" },
    select: { provider: true },
  });
  return rows.map((r) => r.provider);
}
