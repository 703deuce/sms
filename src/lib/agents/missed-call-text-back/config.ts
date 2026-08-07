import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import {
  DEFAULT_MCTB_CONFIG,
  DEFAULT_MCTB_MESSAGE,
  type MissedCallTextConfigRecord,
  type MissedCallTextSettingsUpdate,
} from "./types";

export function configToRecord(row: {
  id: string;
  workspaceId: string;
  agentId: string | null;
  enabled: boolean;
  delaySeconds: number;
  messageTemplate: string;
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
  sendAfterVoicemail: boolean;
  businessHoursOnly: boolean;
  allowedStartTime: string | null;
  allowedEndTime: string | null;
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  maxMessagesPerCaller: number;
  cooldownMinutes: number;
  suppressKnownSpam: boolean;
  suppressBlockedNumbers: boolean;
  suppressOptedOutNumbers: boolean;
  conversationEnabled: boolean;
  phoneNumberId: string | null;
}): MissedCallTextConfigRecord {
  return { ...row };
}

export async function loadMissedCallTextConfig(
  workspaceId: string,
): Promise<MissedCallTextConfigRecord> {
  const prisma = getPrisma();
  let row = await prisma.missedCallTextConfig.findUnique({
    where: { workspaceId },
  });
  if (!row) {
    row = await prisma.missedCallTextConfig.create({
      data: {
        workspaceId,
        ...DEFAULT_MCTB_CONFIG,
      },
    });
  }
  return configToRecord(row);
}

export async function updateMissedCallTextConfig(input: {
  workspaceId: string;
  patch: MissedCallTextSettingsUpdate;
  actor?: string | null;
  source?: string;
  requestedNaturalLanguage?: string | null;
  toolCallId?: string | null;
}): Promise<{
  ok: true;
  config: MissedCallTextConfigRecord;
  changed: Record<string, { before: unknown; after: unknown }>;
}> {
  const prisma = getPrisma();
  const before = await loadMissedCallTextConfig(input.workspaceId);
  const data: Prisma.MissedCallTextConfigUpdateInput = {};
  const changed: Record<string, { before: unknown; after: unknown }> = {};

  const mark = (field: string, afterVal: unknown, beforeVal: unknown) => {
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changed[field] = { before: beforeVal, after: afterVal };
    }
  };

  if (input.patch.enabled !== undefined) {
    data.enabled = input.patch.enabled;
    mark("enabled", input.patch.enabled, before.enabled);
  }
  if (input.patch.delay_seconds !== undefined) {
    const v = Math.max(0, Math.floor(Number(input.patch.delay_seconds)));
    data.delaySeconds = v;
    mark("delaySeconds", v, before.delaySeconds);
  }
  if (input.patch.initial_message !== undefined) {
    const v = String(input.patch.initial_message).trim() || DEFAULT_MCTB_MESSAGE;
    data.messageTemplate = v;
    mark("messageTemplate", v, before.messageTemplate);
  }
  if (input.patch.cooldown_minutes !== undefined) {
    const v = Math.max(0, Math.floor(Number(input.patch.cooldown_minutes)));
    data.cooldownMinutes = v;
    mark("cooldownMinutes", v, before.cooldownMinutes);
  }
  if (input.patch.max_messages_per_caller !== undefined) {
    const v = Math.max(1, Math.floor(Number(input.patch.max_messages_per_caller)));
    data.maxMessagesPerCaller = v;
    mark("maxMessagesPerCaller", v, before.maxMessagesPerCaller);
  }
  if (input.patch.phone_number_id !== undefined) {
    data.phoneNumberId = input.patch.phone_number_id;
    mark("phoneNumberId", input.patch.phone_number_id, before.phoneNumberId);
  }
  const rules = input.patch.trigger_rules;
  if (rules) {
    if (rules.no_answer !== undefined) {
      data.sendAfterNoAnswer = rules.no_answer;
      mark("sendAfterNoAnswer", rules.no_answer, before.sendAfterNoAnswer);
    }
    if (rules.busy !== undefined) {
      data.sendAfterBusy = rules.busy;
      mark("sendAfterBusy", rules.busy, before.sendAfterBusy);
    }
    if (rules.rejected !== undefined) {
      data.sendAfterRejected = rules.rejected;
      mark("sendAfterRejected", rules.rejected, before.sendAfterRejected);
    }
    if (rules.timeout !== undefined) {
      data.sendAfterTimeout = rules.timeout;
      mark("sendAfterTimeout", rules.timeout, before.sendAfterTimeout);
    }
    if (rules.voicemail !== undefined) {
      data.sendAfterVoicemail = rules.voicemail;
      mark("sendAfterVoicemail", rules.voicemail, before.sendAfterVoicemail);
    }
  }
  const qh = input.patch.quiet_hours;
  if (qh) {
    if (qh.enabled !== undefined) {
      data.quietHoursEnabled = qh.enabled;
      mark("quietHoursEnabled", qh.enabled, before.quietHoursEnabled);
    }
    if (qh.start !== undefined) {
      data.quietHoursStart = qh.start || null;
      mark("quietHoursStart", qh.start || null, before.quietHoursStart);
    }
    if (qh.end !== undefined) {
      data.quietHoursEnd = qh.end || null;
      mark("quietHoursEnd", qh.end || null, before.quietHoursEnd);
    }
  }

  const row = await prisma.missedCallTextConfig.upsert({
    where: { workspaceId: input.workspaceId },
    create: { workspaceId: input.workspaceId, ...DEFAULT_MCTB_CONFIG, ...data },
    update: data,
  });

  for (const [field, delta] of Object.entries(changed)) {
    await prisma.agentConfigurationChange.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: before.agentId,
        source: input.source || "owner_john",
        actor: input.actor || null,
        field,
        oldValue: delta.before as Prisma.InputJsonValue,
        newValue: delta.after as Prisma.InputJsonValue,
        requestedNaturalLanguage: input.requestedNaturalLanguage || null,
        toolCallId: input.toolCallId || null,
      },
    });
  }

  return { ok: true, config: configToRecord(row), changed };
}

/** Sync legacy SolutionSetup wizard config into canonical MissedCallTextConfig. */
export async function syncConfigFromSolutionSetup(workspaceId: string) {
  const prisma = getPrisma();
  const setup = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: "missed-call-text-back" },
  });
  if (!setup?.configJson) return null;
  const c = setup.configJson as Record<string, unknown>;
  const delaySeconds =
    Number(c.initialDelaySeconds || 0) > 0
      ? Number(c.initialDelaySeconds)
      : Math.max(0, Number(c.initialDelayMinutes || 0) * 60);
  return updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: setup.status === "ACTIVE" && c.activate !== false,
      delay_seconds: delaySeconds,
      initial_message: String(c.firstMessage || DEFAULT_MCTB_MESSAGE),
      phone_number_id: (c.phoneNumberId as string) || null,
    },
    source: "solution_setup_sync",
  });
}
