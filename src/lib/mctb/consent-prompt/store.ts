import { getPrisma } from "@/lib/db";
import { promptHash } from "@/lib/smart-routing/session-store";
import { defaultMctbConsentScript, DEFAULT_MCTB_CONSENT_VOICE_ID } from "./defaults";
import type { MctbConsentPromptConfig } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function computeConsentScriptHash(
  scriptText: string,
  voiceId: string,
  speed: number,
): string {
  return promptHash(scriptText.trim(), voiceId, speed);
}

export function defaultConsentPromptConfig(businessName?: string): MctbConsentPromptConfig {
  return {
    scriptText: defaultMctbConsentScript(businessName),
    voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
    speed: 1,
    audioAssetId: null,
    scriptHash: null,
    audioStatus: "none",
    publishedAt: null,
    publishedScriptHash: null,
    publishedAudioAssetId: null,
    publishedVersion: 0,
    flowId: null,
    lastGeneratedAt: null,
  };
}

function parseStored(raw: unknown, businessName?: string): MctbConsentPromptConfig {
  const base = defaultConsentPromptConfig(businessName);
  const stored = asRecord(raw);
  return {
    ...base,
    scriptText: String(stored.scriptText || base.scriptText),
    voiceId: String(stored.voiceId || base.voiceId),
    speed: Number(stored.speed ?? base.speed),
    audioAssetId: (stored.audioAssetId as string) || null,
    scriptHash: (stored.scriptHash as string) || null,
    audioStatus: (stored.audioStatus as MctbConsentPromptConfig["audioStatus"]) || "none",
    publishedAt: (stored.publishedAt as string) || null,
    publishedScriptHash: (stored.publishedScriptHash as string) || null,
    publishedAudioAssetId: (stored.publishedAudioAssetId as string) || null,
    publishedVersion: Number(stored.publishedVersion || 0),
    flowId: (stored.flowId as string) || null,
    lastGeneratedAt: (stored.lastGeneratedAt as string) || null,
  };
}

export async function loadMctbConsentPrompt(workspaceId: string): Promise<MctbConsentPromptConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true, customFieldsConfig: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const businessName = ws?.displayName || ws?.name || undefined;
  return parseStored(mctb.consentPrompt, businessName);
}

export async function saveMctbConsentPrompt(
  workspaceId: string,
  patch: Partial<MctbConsentPromptConfig>,
): Promise<MctbConsentPromptConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true, name: true, displayName: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const businessName = ws?.displayName || ws?.name || undefined;
  const current = parseStored(mctb.consentPrompt, businessName);

  const next: MctbConsentPromptConfig = { ...current, ...patch };
  const newHash = computeConsentScriptHash(next.scriptText, next.voiceId, next.speed);

  if (
    patch.scriptText !== undefined ||
    patch.voiceId !== undefined ||
    patch.speed !== undefined
  ) {
    if (next.audioAssetId && next.scriptHash && next.scriptHash !== newHash) {
      next.audioStatus = "stale";
    } else if (!next.audioAssetId) {
      next.audioStatus = "none";
    }
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          consentPrompt: next,
        },
      },
    },
  });

  return next;
}

export function isConsentPromptPublished(config: MctbConsentPromptConfig): boolean {
  return Boolean(
    config.publishedAt &&
      config.publishedAudioAssetId &&
      config.publishedScriptHash &&
      config.publishedScriptHash ===
        computeConsentScriptHash(config.scriptText, config.voiceId, config.speed) &&
      config.audioStatus === "ready" &&
      config.audioAssetId === config.publishedAudioAssetId,
  );
}

export function canPublishConsentPrompt(config: MctbConsentPromptConfig): {
  ok: boolean;
  reason?: string;
} {
  const hash = computeConsentScriptHash(config.scriptText, config.voiceId, config.speed);
  if (!config.scriptText.trim()) {
    return { ok: false, reason: "Consent script is required" };
  }
  if (!config.audioAssetId) {
    return { ok: false, reason: "Generate audio before publishing" };
  }
  if (config.audioStatus === "stale") {
    return { ok: false, reason: "Script changed — regenerate audio before publishing" };
  }
  if (config.scriptHash !== hash) {
    return { ok: false, reason: "Audio does not match current script — regenerate" };
  }
  return { ok: true };
}
