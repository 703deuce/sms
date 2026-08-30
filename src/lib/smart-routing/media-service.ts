import "server-only";

import { createHash } from "crypto";
import { access, writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  isElevenLabsConfigured,
  synthesizeElevenLabsSpeech,
} from "@/lib/voice/elevenlabs/client";
import { RECEPTIONIST_TTS_MODEL } from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import {
  MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID,
  MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
} from "@/lib/mctb/texml-ingress/frozen-pipeline";
import { promptHash } from "./session-store";
import type { DraftConfig } from "./types";

const AUDIO_DIR = path.join(process.cwd(), "public", "smart-routing-audio");

/** Shipped in public/smart-routing-audio/*.mp3 — no per-workspace DB row required. */
const BUNDLED_PLATFORM_AUDIO_IDS = new Set([
  MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID,
  MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
]);

/** Telnyx-facing HTTPS URL — always the public API route (not ephemeral /public files). */
export function publicPlaybackUrl(assetId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const pathPart = `/api/public/smart-routing-audio/${assetId}`;
  return base ? `${base.replace(/\/$/, "")}${pathPart}` : pathPart;
}

/** @deprecated Use publicPlaybackUrl — static /public paths are not reliable on deploy. */
export function publicAudioUrl(assetId: string): string {
  return publicPlaybackUrl(assetId);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeAudioFile(assetId: string, bytes: Buffer): Promise<string> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const filePath = path.join(AUDIO_DIR, `${assetId}.mp3`);
  await writeFile(filePath, bytes);
  return filePath;
}

async function synthesizeAssetBytes(asset: {
  sourceText: string | null;
  providerVoiceId: string | null;
  metadataJson: unknown;
}): Promise<Buffer | null> {
  const text = asset.sourceText?.trim();
  const voiceId = asset.providerVoiceId?.trim();
  if (!text || !voiceId || !isElevenLabsConfigured()) return null;
  const meta = (asset.metadataJson || {}) as { speed?: number };
  const audioBuffer = await synthesizeElevenLabsSpeech({
    text,
    voiceId,
    modelId: RECEPTIONIST_TTS_MODEL,
    speed: meta.speed ?? 1,
  });
  return Buffer.from(audioBuffer);
}

async function readBundledPlatformAudioBytes(assetId: string): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  if (!BUNDLED_PLATFORM_AUDIO_IDS.has(assetId)) return null;
  const diskPath = path.join(AUDIO_DIR, `${assetId}.mp3`);
  if (!(await fileExists(diskPath))) return null;
  return { bytes: await readFile(diskPath), mimeType: "audio/mpeg" };
}

/** Read greeting bytes from disk or regenerate from DB metadata (post-deploy safe). */
export async function readSmartRoutingAudioBytes(assetId: string): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  const bundled = await readBundledPlatformAudioBytes(assetId);
  if (bundled) return bundled;

  const prisma = getPrisma();
  const asset = await prisma.smartRoutingAudioAsset.findUnique({
    where: { id: assetId },
  });
  if (!asset || asset.status !== "ready") return null;

  const mimeType = asset.mimeType || "audio/mpeg";
  const diskPath =
    asset.storageKey && (await fileExists(asset.storageKey))
      ? asset.storageKey
      : path.join(AUDIO_DIR, `${assetId}.mp3`);

  if (await fileExists(diskPath)) {
    return { bytes: await readFile(diskPath), mimeType };
  }

  const regenerated = await synthesizeAssetBytes(asset);
  if (!regenerated) return null;

  const filePath = await writeAudioFile(assetId, regenerated);
  const playbackUrl = publicPlaybackUrl(assetId);
  await prisma.smartRoutingAudioAsset.update({
    where: { id: assetId },
    data: {
      storageKey: filePath,
      processedUrl: playbackUrl,
      mimeType: "audio/mpeg",
    },
  });

  return { bytes: regenerated, mimeType: "audio/mpeg" };
}

export async function listAudioAssets(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingAudioAsset.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAudioAsset(workspaceId: string, assetId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingAudioAsset.findFirst({
    where: { id: assetId, workspaceId },
  });
}

export async function generatePromptAudio(input: {
  workspaceId: string;
  name: string;
  text: string;
  voiceId: string;
  speed?: number;
}) {
  const prisma = getPrisma();
  const hash = promptHash(input.text, input.voiceId, input.speed ?? 1);
  const existing = await prisma.smartRoutingAudioAsset.findFirst({
    where: { workspaceId: input.workspaceId, promptHash: hash, status: "ready" },
  });
  if (existing?.processedUrl) return existing;

  if (!isElevenLabsConfigured()) {
    throw new Error("ElevenLabs is not configured for audio generation");
  }

  const audioBuffer = await synthesizeElevenLabsSpeech({
    text: input.text,
    voiceId: input.voiceId,
    modelId: RECEPTIONIST_TTS_MODEL,
    speed: input.speed ?? 1,
  });

  await mkdir(AUDIO_DIR, { recursive: true });
  const assetId = createId();
  const filePath = path.join(AUDIO_DIR, `${assetId}.mp3`);
  await writeFile(filePath, Buffer.from(audioBuffer));

  const processedUrl = publicPlaybackUrl(assetId);
  const last = await prisma.smartRoutingAudioAsset.findFirst({
    where: { workspaceId: input.workspaceId, name: input.name },
    orderBy: { versionNumber: "desc" },
  });

  return prisma.smartRoutingAudioAsset.create({
    data: {
      id: assetId,
      workspaceId: input.workspaceId,
      name: input.name,
      sourceType: "elevenlabs",
      sourceText: input.text,
      provider: "elevenlabs",
      providerVoiceId: input.voiceId,
      promptHash: hash,
      processedUrl,
      storageKey: filePath,
      mimeType: "audio/mpeg",
      versionNumber: (last?.versionNumber ?? 0) + 1,
      status: "ready",
      metadataJson: { speed: input.speed ?? 1 },
    },
  });
}

export async function createTelnyxTtsDraft(input: {
  workspaceId: string;
  name: string;
  text: string;
}) {
  const prisma = getPrisma();
  return prisma.smartRoutingAudioAsset.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      name: input.name,
      sourceType: "telnyx_tts_reference",
      sourceText: input.text,
      provider: "telnyx",
      status: "draft",
    },
  });
}

export async function saveUploadedAudio(input: {
  workspaceId: string;
  name: string;
  buffer: Buffer;
  mimeType: string;
}) {
  await mkdir(AUDIO_DIR, { recursive: true });
  const assetId = createId();
  const ext = input.mimeType.includes("wav") ? "wav" : "mp3";
  const filePath = path.join(AUDIO_DIR, `${assetId}.${ext}`);
  await writeFile(filePath, input.buffer);
  const prisma = getPrisma();
  return prisma.smartRoutingAudioAsset.create({
    data: {
      id: assetId,
      workspaceId: input.workspaceId,
      name: input.name,
      sourceType: "upload",
      originalUrl: filePath,
      processedUrl: publicAudioUrl(assetId),
      storageKey: filePath,
      mimeType: input.mimeType,
      status: "ready",
    },
  });
}

export async function resolveAudioUrlForAsset(
  workspaceId: string,
  assetId?: string | null,
): Promise<string | null> {
  if (!assetId) return null;
  const asset = await getAudioAsset(workspaceId, assetId);
  if (!asset || asset.status !== "ready") return null;
  return publicPlaybackUrl(asset.id);
}

export async function ensureDraftGreetingAudio(
  workspaceId: string,
  draft: DraftConfig,
): Promise<DraftConfig> {
  const greeting = draft.greeting;
  if (!greeting) return draft;
  const text = greeting.text?.trim();
  if (!text) return draft;

  if (greeting.source === "telnyx_tts") return draft;

  if (greeting.audioAssetId) return draft;

  if (greeting.source !== "elevenlabs") return draft;

  if (!isElevenLabsConfigured()) {
    return {
      ...draft,
      greeting: {
        ...greeting,
        source: "telnyx_tts",
        text,
      },
    };
  }

  const {
    DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
    normalizeWizardVoiceToElevenLabs,
  } = await import("@/lib/voice/elevenlabs/receptionist-voice-catalog");
  const voiceId = normalizeWizardVoiceToElevenLabs(
    greeting.voiceId ?? DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
  );

  try {
    const asset = await generatePromptAudio({
      workspaceId,
      name: "Main greeting",
      text,
      voiceId,
      speed: greeting.speed ?? 1,
    });

    return {
      ...draft,
      greeting: {
        ...greeting,
        source: "elevenlabs",
        voiceId,
        audioAssetId: asset.id,
      },
    };
  } catch (err) {
    console.warn("[ensureDraftGreetingAudio] ElevenLabs failed — falling back to Telnyx TTS", err);
    return {
      ...draft,
      greeting: {
        ...greeting,
        source: "telnyx_tts",
        text,
      },
    };
  }
}

export function hashUpload(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
