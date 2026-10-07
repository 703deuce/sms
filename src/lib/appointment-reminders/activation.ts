import "server-only";

import { getPrisma } from "@/lib/db";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export const APPOINTMENT_REMINDERS_SOLUTION_TYPE = "appointment-reminders-product";

export type AppointmentRemindersActivationConfig = {
  activatedAt?: string | null;
  activatedByUserId?: string | null;
};

export async function loadAppointmentRemindersActivation(
  workspaceId: string,
): Promise<AppointmentRemindersActivationConfig> {
  const prisma = getPrisma();
  const row = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: APPOINTMENT_REMINDERS_SOLUTION_TYPE },
    orderBy: { updatedAt: "desc" },
  });
  const cfg = (row?.configJson || {}) as AppointmentRemindersActivationConfig;
  return {
    activatedAt: cfg.activatedAt ?? null,
    activatedByUserId: cfg.activatedByUserId ?? null,
  };
}

export async function saveAppointmentRemindersActivation(
  workspaceId: string,
  patch: Partial<AppointmentRemindersActivationConfig>,
): Promise<AppointmentRemindersActivationConfig> {
  const prisma = getPrisma();
  const current = await loadAppointmentRemindersActivation(workspaceId);
  const next = { ...current, ...patch };
  const existing = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: APPOINTMENT_REMINDERS_SOLUTION_TYPE },
  });
  if (existing) {
    await prisma.solutionSetup.update({
      where: { id: existing.id },
      data: { configJson: next as object, status: "ACTIVE", name: "Appointment Reminders" },
    });
  } else {
    await prisma.solutionSetup.create({
      data: {
        workspaceId,
        solutionType: APPOINTMENT_REMINDERS_SOLUTION_TYPE,
        name: "Appointment Reminders",
        status: "ACTIVE",
        configJson: next as object,
        externalKey: `appointment-reminders:${workspaceId}`,
      },
    });
  }
  return next;
}

export type AppointmentRemindersSetupReadiness = {
  calendarConnected: boolean;
  hasImportCalendars: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  smsSenderReady: boolean;
  remindersConfigured: boolean;
  activated: boolean;
  activatedAt: string | null;
  canActivate: boolean;
  blockers: string[];
};

export async function evaluateAppointmentRemindersSetupReadiness(
  workspaceId: string,
): Promise<AppointmentRemindersSetupReadiness> {
  const prisma = getPrisma();
  const [connections, platform, activation] = await Promise.all([
    prisma.voiceCalendarConnection.findMany({
      where: { workspaceId, provider: { in: ["google", "microsoft"] } },
      select: { status: true, lastSyncAt: true, config: true },
    }),
    loadAppointmentPlatformConfig(workspaceId),
    loadAppointmentRemindersActivation(workspaceId),
  ]);

  const calendarConnected = connections.some((c) => isCalendarConnectionUsable(c.status));
  const hasImportCalendars = connections.some((c) => {
    const cfg = (c.config || {}) as { importCalendarIds?: string[] };
    return (cfg.importCalendarIds?.length ?? 0) > 0;
  });
  const lastSyncAt = connections
    .map((c) => c.lastSyncAt)
    .filter(Boolean)
    .sort((a, b) => (b!.getTime() > a!.getTime() ? 1 : -1))[0];
  const syncError = connections
    .map((c) => (c.config as { lastSyncError?: string })?.lastSyncError)
    .find(Boolean);

  let smsSenderReady = false;
  try {
    const { getMerchantPaymentStatus } = await import("@/lib/merchant-payments/service");
    const merchantStatus = await getMerchantPaymentStatus(workspaceId);
    smsSenderReady = Boolean(
      merchantStatus &&
        (merchantStatus as { sms?: { ready?: boolean } }).sms?.ready !== false,
    );
  } catch {
    smsSenderReady = false;
  }

  const stepsEnabled =
    platform.reminders.confirmation.enabled ||
    platform.reminders.reminder24h.enabled ||
    platform.reminders.reminder2h.enabled ||
    (platform.reminders.additionalSteps || []).some((s) => s.enabled);

  const blockers: string[] = [];
  if (!calendarConnected) blockers.push("Connect Google Calendar or Microsoft 365");
  if (!hasImportCalendars) blockers.push("Select at least one calendar to import");
  if (!lastSyncAt) blockers.push("Run an initial calendar sync");
  if (syncError) blockers.push("Resolve calendar sync errors");
  if (!smsSenderReady) blockers.push("SMS sender is not ready");
  if (!stepsEnabled) blockers.push("Enable at least one reminder step");

  const canActivate = blockers.length === 0;

  return {
    calendarConnected,
    hasImportCalendars,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    syncError: syncError ?? null,
    smsSenderReady,
    remindersConfigured: stepsEnabled,
    activated: Boolean(activation.activatedAt),
    activatedAt: activation.activatedAt ?? null,
    canActivate,
    blockers,
  };
}
