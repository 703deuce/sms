/**
 * Campaign trigger model — how customers enter a campaign.
 * All sources (manual, CSV, webhook, API, future Zapier/Make) call enrollContactInCampaign.
 */

import type { CampaignTemplateFilter } from "@/lib/reputation/campaign-templates";

export type CampaignTriggerType = "manual" | "webhook" | "api";

/** Provenance of a single recipient enrollment. */
export type EnrollmentSource =
  | "manual"
  | "csv"
  | "contacts"
  | "webhook"
  | "api"
  | "zapier"
  | "make"
  | "n8n"
  | "native_integration";

export type CampaignTriggerConfig = {
  /** Accepted webhook / automation event type */
  eventType?: string;
  endpointId?: string | null;
  /** Staff may still Add contact when primary trigger is webhook */
  allowManualEnrollment?: boolean;
  /** Reserved for future connectors */
  connector?: "zapier" | "make" | "n8n" | "api" | null;
};

export const DEFAULT_TRIGGER_CONFIG: CampaignTriggerConfig = {
  eventType: "service.completed",
  allowManualEnrollment: true,
};

export function normalizeTriggerType(raw: unknown): CampaignTriggerType {
  if (raw === "webhook" || raw === "api" || raw === "manual") return raw;
  return "manual";
}

export function parseTriggerConfig(raw: unknown): CampaignTriggerConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TRIGGER_CONFIG };
  const o = raw as Record<string, unknown>;
  return {
    eventType: typeof o.eventType === "string" ? o.eventType : DEFAULT_TRIGGER_CONFIG.eventType,
    endpointId: typeof o.endpointId === "string" ? o.endpointId : null,
    allowManualEnrollment:
      o.allowManualEnrollment === undefined ? true : Boolean(o.allowManualEnrollment),
    connector:
      o.connector === "zapier" ||
      o.connector === "make" ||
      o.connector === "n8n" ||
      o.connector === "api"
        ? o.connector
        : null,
  };
}

/** Template gallery filters recommended for a trigger. */
export function templateFiltersForTrigger(
  trigger: CampaignTriggerType
): CampaignTemplateFilter[] {
  if (trigger === "webhook" || trigger === "api") {
    return ["automatic", "service-business"];
  }
  return ["manual-csv"];
}

/** Featured / recommended template ids for a trigger (ordered). */
export function recommendedTemplateIdsForTrigger(trigger: CampaignTriggerType): string[] {
  if (trigger === "webhook" || trigger === "api") {
    return [
      "sms-email-follow-up",
      "sms-first-quick-request",
      "delayed-post-completion",
      "one-touch-minimal",
    ];
  }
  return ["past-customer-reactivation", "email-only-gentle", "one-touch-minimal"];
}

export function triggerLabel(trigger: CampaignTriggerType, config?: CampaignTriggerConfig): string {
  if (trigger === "webhook") {
    const ev = config?.eventType || "service.completed";
    return `Webhook — ${ev}`;
  }
  if (trigger === "api") return "API / integration";
  return "Manual / CSV";
}

export function triggerTimelineLabel(
  trigger: CampaignTriggerType,
  config?: CampaignTriggerConfig
): string {
  if (trigger === "webhook") {
    return `Webhook: ${config?.eventType || "service.completed"}`;
  }
  if (trigger === "api") return "API enrollment";
  return "Manual enrollment";
}
