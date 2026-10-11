import "server-only";

import { getPrisma } from "@/lib/db";
import {
  configuredReminderSteps,
  workspaceRemindersOperational,
} from "@/lib/appointments/reminder-delivery";
import {
  clampEffectiveFireAfterConfirmationGap,
  resolveEffectiveReminderFireTime,
} from "@/lib/appointment-reminders/reminder-effective-fire-time";
import { currentReminderGeneration, wasReminderSent } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { isAppointmentReminderImportEligible } from "@/lib/calendar/import-eligibility";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";

const DISCOVERY_BATCH = 250;
const MAX_DISPATCH_ENQUEUE_PER_TICK = 2_000;
const FIRE_TOLERANCE_MS = 4 * 60_000;
/** Reminders later than this are marked suppressed (not silently dropped). */
export const REMINDER_MAX_LATE_MS = 30 * 60_000;

function reminderDiscoveryWorkspaceScope(): string | undefined {
  const scoped = process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE?.trim();
  return scoped || undefined;
}

export async function discoverAndEnqueueDueAppointmentReminders(): Promise<{
  examined: number;
  due: number;
  enqueued: number;
  suppressedLate: number;
}> {
  const prisma = getPrisma();
  const now = Date.now();
  let examined = 0;
  let due = 0;
  let enqueued = 0;
  let suppressedLate = 0;
  let suppressedNoWindow = 0;

  let cursorStartsAt: Date | null = null;
  let cursorId: string | null = null;

  while (enqueued < MAX_DISPATCH_ENQUEUE_PER_TICK) {
    const scopeWorkspaceId = reminderDiscoveryWorkspaceScope();
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        ...(scopeWorkspaceId ? { workspaceId: scopeWorkspaceId } : {}),
        startsAt: { gt: new Date(now - REMINDER_MAX_LATE_MS - FIRE_TOLERANCE_MS) },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
        ...(cursorStartsAt && cursorId
          ? {
              OR: [
                { startsAt: { gt: cursorStartsAt } },
                { startsAt: cursorStartsAt, id: { gt: cursorId } },
              ],
            }
          : {}),
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: DISCOVERY_BATCH,
    });

    if (!rows.length) break;

    for (const row of rows) {
      examined += 1;
      if (!scopeWorkspaceId && !(await workspaceRemindersOperational(row.workspaceId))) continue;
      const meta = (row.metadata || {}) as AppointmentMetadata;
      if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) continue;
      if (!isAppointmentReminderImportEligible(meta)) continue;
      const { shouldHoldRemindersForAppointment } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/ar-reminder-guard"
      );
      if (shouldHoldRemindersForAppointment(meta)) continue;

      if (!scopeWorkspaceId) {
        const { shouldSkipPlatformRemindersForAppointment } = await import(
          "@/lib/appointment-workflows/platform-guard"
        );
        const service = row.serviceName
          ? await prisma.voiceService.findFirst({
              where: { workspaceId: row.workspaceId, name: row.serviceName },
              select: { id: true },
            })
          : null;
        if (
          await shouldSkipPlatformRemindersForAppointment(
            row.workspaceId,
            service?.id,
            row.serviceName,
          )
        ) {
          continue;
        }
      }

      const config = await loadAppointmentPlatformConfig(row.workspaceId);
      const {
        isReminderStepDisabledForService,
        appointmentWithinMinimumLeadTime,
        resolveRecipientNotificationPreference,
        shouldRunReminderStepForRecipient,
        resolveStepChannelForAppointment,
      } = await import("@/lib/appointment-reminders/reminder-scheduling-policy");
      const recipientPref = resolveRecipientNotificationPreference(meta, config);
      const steps = configuredReminderSteps(config).filter((s) => {
        if (s.immediate) return false;
        if (isReminderStepDisabledForService(config, s.key, row.serviceName)) return false;
        const ch = resolveStepChannelForAppointment(s.step, config, row.serviceName);
        return shouldRunReminderStepForRecipient(ch, recipientPref);
      });
      const weeklyHours = resolveWeeklyHours(config);
      const generation = currentReminderGeneration(meta);

      const { shouldSkipReminderStepForConfirmation } = await import(
        "@/lib/appointment-reminders/reminder-confirmation-guard"
      );

      for (const scheduled of steps) {
        if (wasReminderSent(meta, scheduled.timelineType)) continue;
        if (
          shouldSkipReminderStepForConfirmation({
            stepKey: scheduled.key,
            step: scheduled.step,
            appointmentStatus: row.status,
            metadata: meta,
            platform: config,
          })
        ) {
          continue;
        }
        const tz = row.timezone || config.timezone || "America/New_York";
        const resolved = resolveEffectiveReminderFireTime({
          step: scheduled.step,
          startsAt: row.startsAt,
          createdAt: row.createdAt,
          weeklyHours,
          timezone: tz,
          dateOverrides: config.dateOverrides,
          reminderQuietHours: config.reminderQuietHours,
          confirmationStepEnabled: config.reminders.confirmation.enabled,
        });

        if ("reason" in resolved) {
          suppressedNoWindow += await suppressNoWindowDispatch({
            workspaceId: row.workspaceId,
            appointmentId: row.id,
            timelineType: scheduled.timelineType,
            generation,
            intendedFireAt: resolved.nominalFireAt,
          });
          continue;
        }

        const sendCtx = {
          step: scheduled.step,
          weeklyHours,
          timezone: tz,
          dateOverrides: config.dateOverrides,
          reminderQuietHours: config.reminderQuietHours,
        };
        const fireAt = clampEffectiveFireAfterConfirmationGap({
          effectiveFireAt: resolved.effectiveFireAt,
          createdAt: row.createdAt,
          startsAt: row.startsAt,
          confirmationStepEnabled: config.reminders.confirmation.enabled,
          ctx: sendCtx,
        });
        const fireMs = fireAt.getTime();

        if (appointmentWithinMinimumLeadTime(row.startsAt, config, now)) {
          continue;
        }

        if (fireMs < now - REMINDER_MAX_LATE_MS) {
          suppressedLate += await suppressLateDispatch({
            workspaceId: row.workspaceId,
            appointmentId: row.id,
            timelineType: scheduled.timelineType,
            generation,
            intendedFireAt: fireAt,
          });
          continue;
        }

        if (now < fireMs - FIRE_TOLERANCE_MS || now > fireMs + FIRE_TOLERANCE_MS) continue;

        due += 1;
        const dispatchId = await upsertPendingDispatch({
          workspaceId: row.workspaceId,
          appointmentId: row.id,
          timelineType: scheduled.timelineType,
          generation,
          intendedFireAt: fireAt,
          stepKey: scheduled.key,
          deferMeta: resolved.deferred
            ? {
                nominalFireAt: resolved.nominalFireAt.toISOString(),
                strategy: resolved.strategy,
              }
            : undefined,
        });
        if (!dispatchId) continue;

        if (process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE !== "1") {
          const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
          await enqueueJob({
            jobType: "ar_dispatch_reminder",
            queueName: "appointment_reminders",
            workspaceId: row.workspaceId,
            payload: { dispatchId },
            idempotencyKey: `ar-dispatch:${row.id}:${scheduled.timelineType}:${generation}`,
            priority: 8,
            wake: true,
          });
        }
        enqueued += 1;
        if (enqueued >= MAX_DISPATCH_ENQUEUE_PER_TICK) break;
      }
      if (enqueued >= MAX_DISPATCH_ENQUEUE_PER_TICK) break;
    }

    const last = rows[rows.length - 1];
    cursorStartsAt = last.startsAt;
    cursorId = last.id;
    if (rows.length < DISCOVERY_BATCH) break;
  }

  return { examined, due, enqueued, suppressedLate, suppressedNoWindow };
}

async function upsertPendingDispatch(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  generation: number;
  intendedFireAt: Date;
  stepKey: string;
  deferMeta?: { nominalFireAt: string; strategy: string };
}): Promise<string | null> {
  const prisma = getPrisma();
  const existing = await prisma.arReminderDispatch.findUnique({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
  });
  if (existing && ["accepted", "sent", "delivered", "submitting", "unknown"].includes(existing.status)) {
    return null;
  }

  const row = await prisma.arReminderDispatch.upsert({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: input.timelineType,
      reminderGeneration: input.generation,
      intendedFireAt: input.intendedFireAt,
      status: "pending",
      metadata: { stepKey: input.stepKey, ...input.deferMeta },
    },
    update: {
      intendedFireAt: input.intendedFireAt,
      status: existing?.status === "failed" ? "pending" : existing?.status || "pending",
      metadata: { stepKey: input.stepKey, ...input.deferMeta },
    },
  });
  return row.id;
}

async function suppressNoWindowDispatch(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  generation: number;
  intendedFireAt: Date;
}): Promise<number> {
  const prisma = getPrisma();
  const existing = await prisma.arReminderDispatch.findUnique({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
  });
  if (existing?.status === "suppressed") return 0;
  await prisma.arReminderDispatch.upsert({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: input.timelineType,
      reminderGeneration: input.generation,
      intendedFireAt: input.intendedFireAt,
      status: "suppressed",
      lastError: "no_allowed_send_window",
    },
    update: { status: "suppressed", lastError: "no_allowed_send_window" },
  });
  return 1;
}

async function suppressLateDispatch(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  generation: number;
  intendedFireAt: Date;
}): Promise<number> {
  const prisma = getPrisma();
  const existing = await prisma.arReminderDispatch.findUnique({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
  });
  if (existing?.status === "suppressed") return 0;
  await prisma.arReminderDispatch.upsert({
    where: {
      appointmentId_timelineType_reminderGeneration: {
        appointmentId: input.appointmentId,
        timelineType: input.timelineType,
        reminderGeneration: input.generation,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: input.timelineType,
      reminderGeneration: input.generation,
      intendedFireAt: input.intendedFireAt,
      status: "suppressed",
      lastError: "too_late",
    },
    update: { status: "suppressed", lastError: "too_late" },
  });
  return 1;
}
