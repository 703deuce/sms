import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { getAgentTemplate } from "@/lib/voice/templates/catalog";

/** Lab templates use Python-side slim instructions — omit multi-KB compiledPrompt from bootstrap. */
export function isLabLiveKitTemplate(templateId: string): boolean {
  const record = getAgentTemplate(templateId);
  if (!record) return false;
  if (record.id === "transovo_receptionist_v1") return false;
  return record.id.startsWith("livekit_") && record.status === "IMPLEMENTED";
}

export function slimReceptionistCompiledForBootstrap(
  compiled: ReceptionistCompiledSnapshot,
): ReceptionistCompiledSnapshot {
  return {
    livekitProfile: compiled.livekitProfile,
    businessName: compiled.businessName,
    agentDisplayName: compiled.agentDisplayName,
    businessDescription: compiled.businessDescription,
    greeting: compiled.greeting,
    language: compiled.language,
    timezone: compiled.timezone,
    answerWhen: compiled.answerWhen,
    capabilities: compiled.capabilities,
    fieldManifest: compiled.fieldManifest,
    enabledBuiltinTools: compiled.enabledBuiltinTools,
    agentJobInstructions: compiled.agentJobInstructions,
    agentPersonalityNotes: compiled.agentPersonalityNotes,
    industry: compiled.industry,
    additionalInstructions: compiled.additionalInstructions,
    businessProfile: compiled.businessProfile,
    bookingPolicy: compiled.bookingPolicy,
    transferPolicy: compiled.transferPolicy,
    realtimeModel: compiled.realtimeModel,
    realtimeOutputMode: compiled.realtimeOutputMode,
    ttsModel: compiled.ttsModel,
    voiceId: compiled.voiceId,
    voiceLabel: compiled.voiceLabel,
    voiceSpeed: compiled.voiceSpeed,
    compiledPrompt: "",
    businessContext: "",
    compiledAt: compiled.compiledAt,
  };
}
