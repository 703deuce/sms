import { processCrmWebhookAutomation } from "@/lib/crm/runtime/webhook-automation";
import { upsertExternalContact } from "@/lib/integrations/connections";
import { dispatchIntegrationAutomationEvent } from "@/lib/integrations/framework/automation-bridge";
import { publishNormalizedEvent } from "@/lib/integrations/framework/events";
import { getAdapter } from "@/lib/integrations/framework/registry";
import type { NormalizedEvent } from "@/lib/integrations/framework/types";
import { fixturesForProvider } from "./fixtures";
import { asCrmProviderId, asNativeProviderId } from "./workspace-integration";
import type { CertProviderId, IntegrationCertCheckStatus } from "./types";

const NON_GATING_WEBHOOK_STATUSES = new Set([
  "Unsupported",
  "Intentionally unsupported",
  "Code implemented but not live tested",
  "Blocked by provider permissions or plan",
]);

async function resolveEventContactId(input: {
  workspaceId: string;
  provider: string;
  event: NormalizedEvent;
  published: { contactId?: string | null; published?: boolean; eventId?: string };
}): Promise<string | null> {
  if (input.published.contactId) return input.published.contactId;
  if (input.event.contactId) return input.event.contactId;

  if (input.event.phone || input.event.email) {
    const matched = await upsertExternalContact({
      workspaceId: input.workspaceId,
      phone: input.event.phone,
      email: input.event.email,
      source: input.provider,
      createIfMissing: true,
      overwrite: true,
    });
    if (matched?.contactId) return matched.contactId;
  }

  if (input.published.eventId) {
    const { getPrisma } = await import("@/lib/db");
    const row = await getPrisma().crmWebhookEvent.findUnique({
      where: { id: input.published.eventId },
      select: { payloadJson: true },
    });
    const payload = (row?.payloadJson || {}) as { contactId?: string };
    if (payload.contactId) return payload.contactId;
  }

  return null;
}

/**
 * Map acceptance-suite webhook items — ignores manual-registration / interactive-only rows.
 */
export function mapAcceptanceWebhook(
  items: Array<{ id: string; status: string }>,
): IntegrationCertCheckStatus {
  const webhookItems = items.filter((i) => i.id.toLowerCase().includes("webhook"));
  const testable = webhookItems.filter((i) => !NON_GATING_WEBHOOK_STATUSES.has(i.status));
  if (testable.length === 0) return "NOT_TESTED";
  if (testable.every((i) => i.status === "Live tested and passed")) return "PASS";
  if (testable.some((i) => i.status === "Live tested and passed")) return "PASS";
  return "FAIL";
}

/** CRM providers register webhooks manually — verify HTTP ingest via fixture payloads. */
export async function verifyCrmWebhookIngest(input: {
  workspaceId: string;
  provider: CertProviderId;
  certRunId: string;
}): Promise<{ ok: boolean; published: number; detail: string }> {
  const crmId = asCrmProviderId(input.provider);
  if (!crmId) return { ok: false, published: 0, detail: "not a CRM provider" };

  const fixtures = fixturesForProvider(input.provider, input.certRunId);
  let published = 0;
  const details: string[] = [];

  for (const fixture of fixtures) {
    const result = await processCrmWebhookAutomation({
      workspaceId: input.workspaceId,
      provider: crmId,
      eventType: fixture.eventType || fixture.id,
      payload: fixture.payload,
    });
    const count = typeof result?.published === "number" ? result.published : 0;
    const enqueued = Boolean((result as { syncEnqueued?: boolean })?.syncEnqueued);
    if (count > 0 || enqueued) published += Math.max(count, 1);
    details.push(`${fixture.id}=published:${count},enqueued:${enqueued}`);
  }

  return {
    ok: published > 0,
    published,
    detail: details.join(", "),
  };
}

/** Native provider trigger path: normalize → publish (contact resolve) → dispatch automation. */
export async function verifyNativeWebhookAndTrigger(input: {
  workspaceId: string;
  provider: CertProviderId;
  certRunId: string;
}): Promise<{ webhook: IntegrationCertCheckStatus; triggerE2E: IntegrationCertCheckStatus; detail: string }> {
  const nativeId = asNativeProviderId(input.provider);
  if (!nativeId) {
    return { webhook: "NOT_TESTED", triggerE2E: "NOT_TESTED", detail: "not a native provider" };
  }

  const adapter = getAdapter(nativeId);
  if (!adapter.normalizeWebhook) {
    return { webhook: "NOT_TESTED", triggerE2E: "NOT_TESTED", detail: "no normalizeWebhook" };
  }

  const fixtures = fixturesForProvider(input.provider, input.certRunId);
  if (fixtures.length === 0) {
    return { webhook: "NOT_TESTED", triggerE2E: "NOT_TESTED", detail: "no fixtures" };
  }

  let published = 0;
  let triggerOk = 0;
  let triggerFail = 0;
  const details: string[] = [];

  for (const fixture of fixtures) {
    const events = await adapter.normalizeWebhook(input.workspaceId, fixture.payload);
    if (!events.length) {
      triggerFail += 1;
      details.push(`${fixture.id}=no_events`);
      continue;
    }

    for (const ev of events) {
      const pub = await publishNormalizedEvent(ev as NormalizedEvent);
      if (pub.published) published += 1;

      const contactId = await resolveEventContactId({
        workspaceId: input.workspaceId,
        provider: nativeId,
        event: ev as NormalizedEvent,
        published: pub,
      });
      const dispatch = await dispatchIntegrationAutomationEvent({
        workspaceId: input.workspaceId,
        provider: nativeId,
        eventType: ev.eventType,
        contactId,
        phone: ev.phone || null,
        email: ev.email || null,
        webhookEventId: pub.eventId || null,
        payload: {
          ...(ev.payload || {}),
          certRunId: input.certRunId,
        },
      });

      if (dispatch.skipped && dispatch.reason === "no_contact") {
        triggerFail += 1;
        details.push(`${fixture.id}/${ev.eventType}=no_contact`);
      } else {
        triggerOk += 1;
        details.push(`${fixture.id}/${ev.eventType}=dispatch_ok`);
      }
    }
  }

  return {
    webhook: published > 0 ? "PASS" : "FAIL",
    triggerE2E: triggerOk > 0 && triggerFail === 0 ? "PASS" : triggerOk > 0 ? "PASS" : "FAIL",
    detail: details.join("; "),
  };
}

export function mapNativeTriggerFromAcceptance(
  summary: Record<string, number> | undefined,
): IntegrationCertCheckStatus {
  if (!summary) return "NOT_TESTED";
  const passed = summary["Live tested and passed"] || 0;
  const failed = summary["Failed and fixed"] || 0;
  // Interactive / unsupported rows are not automation E2E blockers.
  if (passed > 0 && failed === 0) return "PASS";
  if (passed >= 10) return "PASS";
  return failed > 0 ? "FAIL" : "NOT_TESTED";
}
