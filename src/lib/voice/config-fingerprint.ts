import type { VoiceAgentConfig } from "@/lib/voice/types";
import { createHash } from "node:crypto";

export type VoiceConfigFingerprint = {
  promptVersion?: string | null;
  agentVersionId?: string | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  sttProvider?: string | null;
  sttModel?: string | null;
  ttsProvider?: string | null;
  ttsModel?: string | null;
  voiceId?: string | null;
  turnDetectionVersion?: string | null;
  toolSchemaVersion?: string | null;
  pronunciationDictionaryVersion?: string | null;
  runtimeProvider?: string | null;
  fingerprint: string;
};

export function buildVoiceConfigFingerprint(input: {
  config: VoiceAgentConfig;
  agentVersionId?: string | null;
  runtimeProvider?: string | null;
  promptVersion?: string | null;
}): VoiceConfigFingerprint {
  const cfg = input.config;
  const advanced = (cfg.advanced || {}) as Record<string, unknown>;
  const parts = {
    promptVersion: input.promptVersion || String(advanced.promptVersion || "") || null,
    agentVersionId: input.agentVersionId || null,
    llmProvider: cfg.voiceLanguage?.voiceProvider || null,
    llmModel: String(advanced.llmModel || process.env.VOICE_LLM_MODEL || ""),
    sttProvider: cfg.transcription?.sttProvider || null,
    sttModel: cfg.transcription?.sttModel || null,
    ttsProvider: cfg.voiceLanguage?.voiceProvider || null,
    ttsModel: String(advanced.ttsModel || ""),
    voiceId: cfg.voiceLanguage?.voiceId || null,
    turnDetectionVersion: String(advanced.turnDetectionVersion || "v1"),
    toolSchemaVersion: String(advanced.toolSchemaVersion || "v1"),
    pronunciationDictionaryVersion: String(advanced.pronunciationDictionaryVersion || "none"),
    runtimeProvider: input.runtimeProvider || process.env.VOICE_RUNTIME_PROVIDER || null,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16);
  return { ...parts, fingerprint };
}

/** Load fingerprint from a published agent version (Telnyx calls). */
export async function buildVoiceConfigFingerprintForVersion(input: {
  agentVersionId: string | null | undefined;
  runtimeProvider?: string | null;
}): Promise<VoiceConfigFingerprint | null> {
  if (!input.agentVersionId) return null;
  const { getPrisma } = await import("@/lib/db");
  const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
  const prisma = getPrisma();
  const ver = await prisma.voiceAgentVersion.findFirst({
    where: { id: input.agentVersionId },
    select: { id: true, version: true, config: true },
  });
  if (!ver) return null;
  const config = parseVoiceAgentConfig(ver.config);
  return buildVoiceConfigFingerprint({
    config,
    agentVersionId: ver.id,
    runtimeProvider: input.runtimeProvider || "telnyx",
    promptVersion: `v${ver.version}`,
  });
}
