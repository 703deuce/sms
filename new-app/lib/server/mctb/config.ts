import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { MctbFirstTextTemplateConfig } from "@/lib/mctb/first-text-templates/types";
import { readMctbFirstTextTemplateConfig } from "@/lib/mctb/first-text-templates/persistence";

export type MctbRecoveryConfigRecord = {
  /** Workspace master switch from missed_call_text_configs.enabled */
  masterEnabled: boolean;
  /** False when paused — runtime gate */
  enabled: boolean;
  delaySeconds: number;
  cooldownMinutes: number;
  maxMessagesPerCaller: number;
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
  sendAfterVoicemail: boolean;
  senderMode: "PLATFORM" | "WORKSPACE";
  timezone: string;
  manuallyPaused: boolean;
  pauseUntil: string | null;
  firstTextTemplate: MctbFirstTextTemplateConfig;
};

const DEFAULT_CONFIG = {
  enabled: false,
  delaySeconds: 60,
  cooldownMinutes: 60,
  maxMessagesPerCaller: 1,
  sendAfterNoAnswer: true,
  sendAfterBusy: true,
  sendAfterRejected: true,
  sendAfterTimeout: true,
  sendAfterVoicemail: false,
  senderMode: "PLATFORM" as const,
  timezone: "America/New_York",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPauseFromWorkspace(customFieldsConfig: unknown): {
  manuallyPaused: boolean;
  pauseUntil: string | null;
} {
  const mctb = asRecord(asRecord(customFieldsConfig).mctb);
  const pauseUntil = typeof mctb.pauseUntil === "string" ? mctb.pauseUntil : null;
  const manuallyPaused = mctb.manuallyPaused === true;
  return { manuallyPaused, pauseUntil };
}

function isPauseActive(pauseUntil: string | null, manuallyPaused: boolean): boolean {
  if (manuallyPaused) return true;
  if (!pauseUntil) return false;
  const until = new Date(pauseUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
}

export async function loadMctbRecoveryConfig(workspaceId: string): Promise<MctbRecoveryConfigRecord> {
  const prisma = getPrisma();
  let row = await prisma.missedCallTextConfig.findUnique({ where: { workspaceId } });
  if (!row) {
    row = await prisma.missedCallTextConfig.create({
      data: {
        workspaceId,
        ...DEFAULT_CONFIG,
        enabled: false,
        requireCarrierForward: false,
        senderMode: "PLATFORM",
      },
    });
  }
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const pause = readPauseFromWorkspace(ws?.customFieldsConfig);
  const firstTextTemplate = await readMctbFirstTextTemplateConfig(workspaceId);

  const paused = isPauseActive(pause.pauseUntil, pause.manuallyPaused);
  return {
    masterEnabled: row.enabled,
    enabled: row.enabled && !paused,
    delaySeconds: row.delaySeconds,
    cooldownMinutes: row.cooldownMinutes,
    maxMessagesPerCaller: row.maxMessagesPerCaller,
    sendAfterNoAnswer: row.sendAfterNoAnswer,
    sendAfterBusy: row.sendAfterBusy,
    sendAfterRejected: row.sendAfterRejected,
    sendAfterTimeout: row.sendAfterTimeout,
    sendAfterVoicemail: row.sendAfterVoicemail,
    senderMode: row.senderMode === "WORKSPACE" ? "WORKSPACE" : "PLATFORM",
    timezone: row.timezone,
    manuallyPaused: pause.manuallyPaused,
    pauseUntil: pause.pauseUntil,
    firstTextTemplate,
  };
}

export async function updateMctbRecoveryConfig(
  workspaceId: string,
  patch: Partial<{
    enabled: boolean;
    delaySeconds: number;
    cooldownMinutes: number;
    sendAfterNoAnswer: boolean;
    sendAfterBusy: boolean;
    sendAfterRejected: boolean;
    sendAfterTimeout: boolean;
    sendAfterVoicemail: boolean;
    manuallyPaused: boolean;
    pauseUntil: string | null;
  }>,
) {
  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.delaySeconds !== undefined) data.delaySeconds = patch.delaySeconds;
  if (patch.cooldownMinutes !== undefined) data.cooldownMinutes = patch.cooldownMinutes;
  if (patch.sendAfterNoAnswer !== undefined) data.sendAfterNoAnswer = patch.sendAfterNoAnswer;
  if (patch.sendAfterBusy !== undefined) data.sendAfterBusy = patch.sendAfterBusy;
  if (patch.sendAfterRejected !== undefined) data.sendAfterRejected = patch.sendAfterRejected;
  if (patch.sendAfterTimeout !== undefined) data.sendAfterTimeout = patch.sendAfterTimeout;
  if (patch.sendAfterVoicemail !== undefined) data.sendAfterVoicemail = patch.sendAfterVoicemail;

  if (Object.keys(data).length) {
    data.senderMode = "PLATFORM";
    data.requireCarrierForward = false;
    await prisma.missedCallTextConfig.upsert({
      where: { workspaceId },
      create: { workspaceId, ...DEFAULT_CONFIG, ...data },
      update: data,
    });
  }

  if (patch.manuallyPaused !== undefined || patch.pauseUntil !== undefined) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    });
    const cfg = asRecord(ws?.customFieldsConfig);
    const mctb = asRecord(cfg.mctb);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customFieldsConfig: {
          ...cfg,
          mctb: {
            ...mctb,
            ...(patch.manuallyPaused !== undefined ? { manuallyPaused: patch.manuallyPaused } : {}),
            ...(patch.pauseUntil !== undefined ? { pauseUntil: patch.pauseUntil } : {}),
          },
        },
      },
    });
  }
}

export const COOLDOWN_PRESET_MINUTES = {
  off: 0,
  m30: 30,
  h1: 60,
  h24: 1440,
} as const;
