import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  defaultMctbConsentScript,
} from "@/lib/mctb/consent-prompt/defaults";
import type {
  MctbConsentPromptConfig,
  MctbConsentPromptSource,
} from "@/lib/mctb/consent-prompt/types";
import { toPublicAssetUrl } from "@/lib/server/public-url";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseSource(raw: unknown): MctbConsentPromptSource {
  const s = String(raw || "tts");
  if (s === "upload" || s === "elevenlabs") return s;
  return "tts";
}

export function parseMctbConsentPromptConfig(
  raw: unknown,
  businessName?: string,
): MctbConsentPromptConfig {
  const stored = asRecord(raw);
  return {
    source: parseSource(stored.source),
    scriptText: String(stored.scriptText || defaultMctbConsentScript(businessName)),
    voiceId: stored.voiceId ? String(stored.voiceId) : null,
    audioUrl: stored.audioUrl ? String(stored.audioUrl) : null,
  };
}

export async function loadMctbConsentPrompt(workspaceId: string): Promise<MctbConsentPromptConfig> {
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true, customFieldsConfig: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const businessName = ws?.displayName || ws?.name || undefined;
  return parseMctbConsentPromptConfig(mctb.consentPrompt, businessName);
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
  const current = parseMctbConsentPromptConfig(mctb.consentPrompt, businessName);
  const next: MctbConsentPromptConfig = { ...current, ...patch };

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: { ...mctb, consentPrompt: next },
      },
    },
  });
  return next;
}

export type Press1GatherPlayback =
  | { mode: "audio"; audioUrl: string }
  | { mode: "speak"; text: string };

/** Runtime playback for Press-1 gather (custom MP3 / ElevenLabs or Telnyx TTS). */
export async function resolvePress1GatherPlayback(
  workspaceId: string,
): Promise<Press1GatherPlayback> {
  const prompt = await loadMctbConsentPrompt(workspaceId);
  if (
    (prompt.source === "upload" || prompt.source === "elevenlabs") &&
    prompt.audioUrl?.trim()
  ) {
    return { mode: "audio", audioUrl: toPublicAssetUrl(prompt.audioUrl) };
  }
  const text = prompt.scriptText.trim() || defaultMctbConsentScript();
  return { mode: "speak", text };
}
