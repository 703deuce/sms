import type { VoiceV3AgentConfig } from "./agent-config";

export function logVoiceV3AgentConfigResolved(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  config: VoiceV3AgentConfig;
}): void {
  const c = input.config;
  console.log("VOICE_V3_AGENT_CONFIG_RESOLVED", {
    workspace_id: input.workspaceId,
    agent_id: input.agentId,
    published_version_id: input.publishedVersionId ?? null,
    config_version: c.configVersion ?? null,
    config_source: c.source ?? null,
    business_name: c.businessName,
    agent_name: c.identity?.agentName,
    booking_strategy: c.scheduling?.bookingStrategy,
    voice_id: c.telephony?.liveVoiceId,
    intake_field_count: c.intakeFields.length,
    service_count: c.services?.length ?? 1,
    transfer_destination_count: c.transferDestinations?.length ?? 0,
    knowledge_enabled: c.knowledge?.retrieval?.enabled === true,
    knowledge_source_count:
      (c.knowledge?.retrieval?.knowledgeBaseIds?.length ?? 0) +
      (c.knowledge?.retrieval?.websiteUrl ? 1 : 0),
    capabilities: c.capabilities,
  });
}

export function logVoiceV3ConfigFallbackUsed(field: string, reason: string): void {
  console.warn("VOICE_V3_CONFIG_FALLBACK_USED", { field, reason });
}

export function logVoiceV3CompiledContexts(input: {
  amySectionCount: number;
  astraCharCount: number;
  toolNames: string[];
}): void {
  console.log("VOICE_V3_AMY_CONTEXT_COMPILED", {
    section_count: input.amySectionCount,
  });
  console.log("VOICE_V3_ASTRA_CONTEXT_COMPILED", {
    char_count: input.astraCharCount,
  });
  console.log("VOICE_V3_TOOL_SURFACE_COMPILED", {
    tool_count: input.toolNames.length,
    tools: input.toolNames,
  });
}
