import "server-only";

import { getPrisma } from "@/lib/db";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { hasWorkspaceExistingCustomerSmsConsent } from "@/lib/appointment-reminders/workspace-existing-sms-consent";

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
  smsSenderDetail?: string;
  /** Platform sender metering: allowance configured (not a setup blocker — commercial pass sets plans). */
  smsCommercialAllowanceConfigured: boolean;
  smsCommercialAllowanceDetail?: string;
  emailSenderReady: boolean;
  emailSenderDetail?: string;
  /** At least one enabled reminder step uses the email channel. */
  emailRemindersEnabled: boolean;
  /** At least one enabled reminder step uses the SMS channel. */
  smsRemindersEnabled: boolean;
  remindersConfigured: boolean;
  activated: boolean;
  activatedAt: string | null;
  canActivate: boolean;
  blockers: string[];
  warnings: string[];
  existingCustomerSmsConsentAttested: boolean;
};

function stepUsesSms(
  step: { enabled: boolean; channel?: string },
): boolean {
  return step.enabled && (step.channel || "sms") === "sms";
}

function platformSmsStepsEnabled(platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>): boolean {
  return (
    stepUsesSms(platform.reminders.confirmation) ||
    stepUsesSms(platform.reminders.reminder24h) ||
    stepUsesSms(platform.reminders.reminder2h) ||
    (platform.reminders.additionalSteps || []).some((s) => stepUsesSms(s))
  );
}

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

  const { evaluateArSmsOutboundReadiness } = await import(
    "@/lib/appointment-reminders/ar-sms-readiness"
  );
  const smsReadiness = await evaluateArSmsOutboundReadiness(workspaceId);
  const smsSenderReady = smsReadiness.senderReady;

  const { evaluateArEmailSenderReadiness } = await import(
    "@/lib/appointment-reminders/ar-email-readiness"
  );
  const emailReadiness = await evaluateArEmailSenderReadiness(workspaceId);
  const emailSenderReady = emailReadiness.ready;

  const stepsEnabled =
    platform.reminders.confirmation.enabled ||
    platform.reminders.reminder24h.enabled ||
    platform.reminders.reminder2h.enabled ||
    (platform.reminders.additionalSteps || []).some((s) => s.enabled);

  const anySmsStep = platformSmsStepsEnabled(platform);
  const warnings: string[] = [];
  if (anySmsStep && smsSenderReady && !smsReadiness.commercialAllowanceConfigured) {
    warnings.push(smsReadiness.commercialAllowanceDetail);
  }

  const blockers: string[] = [];
  if (!calendarConnected) blockers.push("Connect Google Calendar or Microsoft 365");
  if (!hasImportCalendars) blockers.push("Select at least one calendar to import");
  if (!lastSyncAt) blockers.push("Run an initial calendar sync");
  if (syncError) blockers.push("Resolve calendar sync errors");
  if (anySmsStep && !smsSenderReady) {
    blockers.push(smsReadiness.senderDetail || "Transovo platform SMS sender is not ready");
  }
  const anyEmailStep =
    platform.reminders.confirmation.channel === "email" ||
    platform.reminders.reminder24h.channel === "email" ||
    platform.reminders.reminder2h.channel === "email" ||
    (platform.reminders.additionalSteps || []).some((s) => s.enabled && s.channel === "email");
  if (anyEmailStep && !emailSenderReady) {
    blockers.push(
      emailReadiness.detail ||
        "Email reminders are enabled in your sequence but Transovo email delivery is not ready yet",
    );
  }
  if (!stepsEnabled) blockers.push("Enable at least one reminder step");

  const existingCustomerSmsConsentAttested = hasWorkspaceExistingCustomerSmsConsent(platform);
  const alreadyActivated = Boolean(activation.activatedAt);
  if (anySmsStep && !existingCustomerSmsConsentAttested && !alreadyActivated) {
    blockers.push(
      "Certify that you already have permission to text customers on your connected calendars",
    );
  }
  if (anySmsStep && !existingCustomerSmsConsentAttested && alreadyActivated) {
    warnings.push(
      "Certify existing customer SMS permission on the activation page for compliance records.",
    );
  }

  const canActivate = blockers.length === 0;

  return {
    calendarConnected,
    hasImportCalendars,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    syncError: syncError ?? null,
    smsSenderReady,
    smsSenderDetail: smsReadiness.senderDetail,
    smsCommercialAllowanceConfigured: smsReadiness.commercialAllowanceConfigured,
    smsCommercialAllowanceDetail: smsReadiness.commercialAllowanceDetail,
    emailSenderReady,
    emailSenderDetail: emailReadiness.detail,
    emailRemindersEnabled: anyEmailStep,
    smsRemindersEnabled: anySmsStep,
    remindersConfigured: stepsEnabled,
    activated: Boolean(activation.activatedAt),
    activatedAt: activation.activatedAt ?? null,
    canActivate,
    blockers,
    warnings,
    existingCustomerSmsConsentAttested,
  };
}
