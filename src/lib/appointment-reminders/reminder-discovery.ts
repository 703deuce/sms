import "server-only";

import { getPrisma } from "@/lib/db";
import {
  configuredReminderSteps,
  resolveStepFireTime,
  shouldSkipStepNow,
  workspaceRemindersOperational,
} from "@/lib/appointments/reminder-delivery";
import { currentReminderGeneration, wasReminderSent } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
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
      if (meta.reminderSmsEligible === false) continue;
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
        const fireAt = resolveStepFireTime(scheduled.step, row.startsAt);
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
        if (shouldSkipStepNow(scheduled.step, fireAt, weeklyHours, row.timezone || config.timezone)) {
          continue;
        }

        due += 1;
        const dispatchId = await upsertPendingDispatch({
          workspaceId: row.workspaceId,
          appointmentId: row.id,
          timelineType: scheduled.timelineType,
          generation,
          intendedFireAt: fireAt,
          stepKey: scheduled.key,
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

  return { examined, due, enqueued, suppressedLate };
}

async function upsertPendingDispatch(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  generation: number;
  intendedFireAt: Date;
  stepKey: string;
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
      metadata: { stepKey: input.stepKey },
    },
    update: {
      intendedFireAt: input.intendedFireAt,
      status: existing?.status === "failed" ? "pending" : existing?.status || "pending",
      metadata: { stepKey: input.stepKey },
    },
  });
  return row.id;
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
