import "server-only";

import { getPrisma } from "@/lib/db";
import {
  DEFAULT_NOTETAKER_CONFIG,
  type EventTypeNotetakerConfig,
  type NotetakerPlatformConfig,
  type SummaryTemplateId,
} from "./types";

export const NOTETAKER_SOLUTION_TYPE = "ai-notetaker";

export async function loadNotetakerConfig(workspaceId: string): Promise<NotetakerPlatformConfig> {
  const prisma = getPrisma();
  const row = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: NOTETAKER_SOLUTION_TYPE },
    orderBy: { updatedAt: "desc" },
  });
  const stored = (row?.configJson || {}) as Partial<NotetakerPlatformConfig>;
  return { ...DEFAULT_NOTETAKER_CONFIG, ...stored };
}

export async function saveNotetakerConfig(
  workspaceId: string,
  patch: Partial<NotetakerPlatformConfig>,
): Promise<NotetakerPlatformConfig> {
  const prisma = getPrisma();
  const current = await loadNotetakerConfig(workspaceId);
  const next = { ...current, ...patch };

  const existing = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: NOTETAKER_SOLUTION_TYPE },
  });

  if (existing) {
    await prisma.solutionSetup.update({
      where: { id: existing.id },
      data: { configJson: next as object, status: "ACTIVE", name: "AI Notetaker" },
    });
  } else {
    await prisma.solutionSetup.create({
      data: {
        workspaceId,
        solutionType: NOTETAKER_SOLUTION_TYPE,
        name: "AI Notetaker",
        status: "ACTIVE",
        configJson: next as object,
        externalKey: `notetaker:${workspaceId}`,
      },
    });
  }
  return next;
}

export function parseEventTypeNotetakerConfig(raw: unknown): EventTypeNotetakerConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    autoJoin: o.autoJoin === true,
    recordingEnabled: o.recordingEnabled !== false,
    transcriptEnabled: o.transcriptEnabled !== false,
    summaryEnabled: o.summaryEnabled !== false,
    actionItemsEnabled: o.actionItemsEnabled !== false,
    followUpEnabled: o.followUpEnabled !== false,
    summaryTemplate:
      typeof o.summaryTemplate === "string"
        ? (o.summaryTemplate as EventTypeNotetakerConfig["summaryTemplate"])
        : "general",
  };
}

export async function resolveBotName(workspaceId: string): Promise<string> {
  const [config, workspace] = await Promise.all([
    loadNotetakerConfig(workspaceId),
    getPrisma().workspace.findUnique({
      where: { id: workspaceId },
      select: { displayName: true, name: true },
    }),
  ]);
  if (config.botName?.trim()) return config.botName.trim();
  const business = workspace?.displayName || workspace?.name;
  return business ? `${business} Notetaker` : "Transovo Notetaker";
}

export async function resolveNotetakerConfigForAppointment(input: {
  workspaceId: string;
  eventTypeId?: string | null;
  eventTypeConfig?: import("@/lib/appointments/types").AppointmentTypeConfig | null;
}): Promise<{
  platform: NotetakerPlatformConfig;
  eventType: EventTypeNotetakerConfig;
  recordingEnabled: boolean;
  transcriptEnabled: boolean;
  summaryEnabled: boolean;
  actionItemsEnabled: boolean;
  followUpEnabled: boolean;
  summaryTemplate: SummaryTemplateId;
}> {
  const platform = await loadNotetakerConfig(input.workspaceId);
  let eventType = parseEventTypeNotetakerConfig(input.eventTypeConfig?.notetaker);
  if (!input.eventTypeConfig?.notetaker && input.eventTypeId) {
    const svc = await getPrisma().voiceService.findFirst({
      where: { id: input.eventTypeId, workspaceId: input.workspaceId },
    });
    eventType = parseEventTypeNotetakerConfig(
      (svc?.config as import("@/lib/appointments/types").AppointmentTypeConfig | null)?.notetaker,
    );
  }
  const eventOverrides = eventType.enabled === true;
  return {
    platform,
    eventType,
    recordingEnabled:
      (eventOverrides ? eventType.recordingEnabled : platform.recordingEnabled) !== false,
    transcriptEnabled:
      (eventOverrides ? eventType.transcriptEnabled : platform.transcriptEnabled) !== false,
    summaryEnabled:
      (eventOverrides ? eventType.summaryEnabled : platform.summaryEnabled) !== false,
    actionItemsEnabled:
      (eventOverrides ? eventType.actionItemsEnabled : platform.actionItemsEnabled) !== false,
    followUpEnabled:
      (eventOverrides ? eventType.followUpEnabled : platform.followUpEnabled) !== false,
    summaryTemplate: eventType.summaryTemplate || platform.summaryTemplate || "general",
  };
}
