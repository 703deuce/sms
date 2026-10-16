import {
  AGENT_TEMPLATE_CATALOG,
  DEFAULT_ACTIVE_TEMPLATE,
  REMOVED_LIVEKIT_TEMPLATE_IDS,
  getAgentTemplate,
  type AgentTemplateRecord,
} from "./catalog";

/** Stored on voiceAgent.draftConfig.advanced and published versions. */
export const LIVEKIT_AGENT_TEMPLATE_KEY = "livekitAgentTemplate";

export function getLiveKitAgentTemplateFromAdvanced(
  advanced: Record<string, unknown> | undefined | null,
): string {
  const direct = advanced?.[LIVEKIT_AGENT_TEMPLATE_KEY];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const wizard = advanced?.receptionistWizard as Record<string, unknown> | undefined;
  const fromWizard = wizard?.livekitAgentTemplate;
  if (typeof fromWizard === "string" && fromWizard.trim()) {
    return fromWizard.trim();
  }

  return DEFAULT_ACTIVE_TEMPLATE;
}

export function isSelectableAgentTemplate(record: AgentTemplateRecord): boolean {
  if (record.status === "COMPOSED_UNVERIFIED") {
    return process.env.ALLOW_COMPOSED_RECEPTIONIST === "1";
  }
  return record.status === "IMPLEMENTED" || record.status === "VERIFIED";
}

export function listSelectableAgentTemplates(): AgentTemplateRecord[] {
  return AGENT_TEMPLATE_CATALOG.filter(isSelectableAgentTemplate);
}

export function normalizeAgentTemplateId(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (trimmed && REMOVED_LIVEKIT_TEMPLATE_IDS.has(trimmed)) {
    throw new Error(
      `${trimmed} was removed — inbound LiveKit uses Voice V3 (GPT-Live Amy/Astra) only`,
    );
  }
  if (!trimmed) return DEFAULT_ACTIVE_TEMPLATE;
  if (getAgentTemplate(trimmed)) return trimmed;
  return DEFAULT_ACTIVE_TEMPLATE;
}
