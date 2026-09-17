import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { getReceptionistCompiledFromAdvanced } from "@/lib/voice/receptionist/runtime";
import { isMinimumSideEffectMode } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import { isConversationWorkflowMode } from "@/lib/voice/workflow-engine/tool-publish";
import { buildVoiceV2LiveIntakeInstructions } from "@/lib/voice-v2/intake/live-intake-instructions";
import { compileVoiceV2IntakeSchema } from "@/lib/voice-v2/intake/compile-schema";
import { isVoiceV2PstnOneAmyMode } from "@/lib/voice-v2/pstn-workflow-mode";
import { buildVoiceV2KnowledgeLayerBInstructions } from "@/lib/voice-v2/knowledge-config";
import { buildVoiceV2QualificationLayerBInstructions } from "@/lib/voice-v2/qualification-config";
import { buildVoiceV2AfterHoursLayerBInstructions } from "@/lib/voice-v2/after-hours-handling-prompt";
import { AMY_V2_CORE_STATIC_PROMPT } from "@/lib/voice-v2/one-amy/amy-core-static-prompt";

export async function loadOpenAiRealtimeSessionInstructions(input: {
  workspaceId: string;
  agentId: string;
}): Promise<{ instructions: string; greeting?: string }> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { name: true, purpose: true, draftConfig: true },
  });
  const config = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const compiled = getReceptionistCompiledFromAdvanced(
    config.advanced as Record<string, unknown> | undefined,
  );
  const oneAmy = isVoiceV2PstnOneAmyMode(config);
  const intakeSchema = compileVoiceV2IntakeSchema(config);
  const intakeBlock = intakeSchema
    ? buildVoiceV2LiveIntakeInstructions(intakeSchema, { oneAmy })
    : "";

  const personality = [
    config.instructions?.tone ? `Tone: ${config.instructions.tone}.` : "",
    config.instructions?.style ? `Style: ${config.instructions.style}.` : "",
    config.instructions?.responseLength
      ? `Response length: ${config.instructions.responseLength}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const base =
    compiled?.compiledPrompt?.trim() ||
    config.instructions?.raw ||
    [
      config.instructions?.system,
      config.instructions?.role,
      agent?.purpose ? `Purpose: ${agent.purpose}` : "",
      config.instructions?.goals,
      personality,
    ]
      .filter(Boolean)
      .join("\n\n");

  const layers = [
    AMY_V2_CORE_STATIC_PROMPT,
    base,
    intakeBlock,
    buildVoiceV2KnowledgeLayerBInstructions(config),
    buildVoiceV2QualificationLayerBInstructions(config),
    buildVoiceV2AfterHoursLayerBInstructions(config),
    isMinimumSideEffectMode(config) ? "MINIMUM-SIDE-EFFECT mode is active." : "",
    isConversationWorkflowMode(config) ? "One continuous Amy session — no handoffs." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const greeting = String(config.callHandling?.greeting || "").trim() || undefined;
  return { instructions: layers.slice(0, 100_000), greeting };
}
