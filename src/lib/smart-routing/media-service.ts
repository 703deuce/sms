import "server-only";

import { createHash } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  isElevenLabsConfigured,
  synthesizeElevenLabsSpeech,
} from "@/lib/voice/elevenlabs/client";
import { promptHash } from "./session-store";

const AUDIO_DIR = path.join(process.cwd(), "public", "smart-routing-audio");

export function publicAudioUrl(assetId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const pathPart = `/smart-routing-audio/${assetId}.mp3`;
  return base ? `${base.replace(/\/$/, "")}${pathPart}` : pathPart;
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
    modelId: "eleven_turbo_v2_5",
    speed: input.speed ?? 1,
  });

  await mkdir(AUDIO_DIR, { recursive: true });
  const assetId = createId();
  const filePath = path.join(AUDIO_DIR, `${assetId}.mp3`);
  await writeFile(filePath, Buffer.from(audioBuffer));

  const processedUrl = publicAudioUrl(assetId);
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
  return asset?.processedUrl ?? null;
}

export function hashUpload(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
