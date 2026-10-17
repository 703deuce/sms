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

/**
 * Map legacy lab templates to the active Voice V3 default — never throw during save/compile.
 */
export function normalizeAgentTemplateId(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (trimmed && REMOVED_LIVEKIT_TEMPLATE_IDS.has(trimmed)) {
    return DEFAULT_ACTIVE_TEMPLATE;
  }
  if (!trimmed) return DEFAULT_ACTIVE_TEMPLATE;
  if (getAgentTemplate(trimmed)) return trimmed;
  return DEFAULT_ACTIVE_TEMPLATE;
}

/** Persist-time cleanup for draft/published advanced blobs still pointing at removed templates. */
export function sanitizeLiveKitTemplateOnAdvanced(
  advanced: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  const base = { ...(advanced || {}) };
  const normalized = normalizeAgentTemplateId(getLiveKitAgentTemplateFromAdvanced(base));
  base[LIVEKIT_AGENT_TEMPLATE_KEY] = normalized;
  const wizard = base.receptionistWizard;
  if (wizard && typeof wizard === "object") {
    const wiz = { ...(wizard as Record<string, unknown>) };
    if (typeof wiz.livekitAgentTemplate === "string") {
      wiz.livekitAgentTemplate = normalized;
    }
    base.receptionistWizard = wiz;
  }
  return base;
}
