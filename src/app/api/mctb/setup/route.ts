import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  loadMissedCallTextConfig,
  updateMissedCallTextConfig,
} from "@/lib/agents/missed-call-text-back/config";
import { loadMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import type { MissedCallTextBackConfig } from "@/lib/solutions/missed-call-text-back/types";
import {
  deriveRequiredActions,
  phoneNumbersSummary,
  tollFreeSummary,
} from "@/lib/compliance-helpers";
import {
  enrichWorkspacePhoneWithMessagingStatus,
  loadMctbSetupPhoneOptions,
} from "@/lib/numbers/workspace-accessible-numbers";
import { loadMctbSetupPhoneOptionsWithTelnyxSync } from "@/lib/mctb/setup-telnyx-messaging-sync";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { isExistingConsentModeEligible } from "@/lib/mctb/setup-consent-eligibility";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";
import { getPhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import { resolveMctbRecoveryOpenerTemplate } from "@/lib/mctb/message-template";
import { EXISTING_CONSENT_ATTESTATION_VERSION } from "@/lib/mctb/capture/attestation";
import {
  resolveCanonicalMctbSetupPhoneId,
  sanitizeMctbSetupPhoneNumberId,
} from "@/lib/mctb/setup-phone-validation";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import {
  loadMctbOnboardingState,
  parseMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import { normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  defaultWeeklySchedule,
  readMctbScheduleFromCustomFields,
  isMctbSchedulePaused,
  previewMctbPauseState,
  normalizeMctbPauseState,
  buildMctbPauseMutation,
  isMctbSetupPausing,
  resolveMctbPauseKind,
} from "@/lib/mctb/schedule";
import {
  isMctbDebugEnabled,
  summarizeMctbPhoneOptions,
  traceMctbDebug,
  traceMctbDebugError,
} from "@/lib/mctb/debug";

export type MctbConsentMode = "press_1" | "existing_consent";

export type MctbSetupPayload = {
  phoneNumberId: string | null;
  smsPhoneNumberId?: string | null;
  enabled?: boolean;
  triggerRules?: {
    noAnswer?: boolean;
    busy?: boolean;
    rejected?: boolean;
    timeout?: boolean;
    voicemail?: boolean;
    afterHours?: boolean;
  };
  messageTemplate?: string;
  messageTemplateBusinessHours?: string | null;
  messageTemplateAfterHours?: string | null;
  delaySeconds?: number;
  consentMode?: MctbConsentMode;
  businessLineE164?: string | null;
  businessHoursOnly?: boolean;
  allowedStartTime?: string | null;
  allowedEndTime?: string | null;
  timezone?: string;
  scheduleMode?: "always_on" | "business_hours" | "after_hours" | "custom";
  weeklySchedule?: {
    timezone: string;
    days: Array<{ day: number; enabled: boolean; startTime: string; endTime: string }>;
  } | null;
  pauseUntil?: string | null;
  cooldownMinutes?: number;
  maxMessagesPerCaller?: number;
  replyNotifications?: boolean;
  directDialForwardE164?: string | null;
  defaultLinkUrl?: string | null;
  requestFormEnabled?: boolean;
  leadCaptureEnabled?: boolean;
  requestFormFieldsJson?: unknown;
  recoveryGoal?: string;
  activate?: boolean;
  existingConsentAttested?: boolean;
  senderMode?: "PLATFORM" | "WORKSPACE";
  platformRecoveryTemplateId?: string;
};

const DEFAULT_CAMPAIGN_DESCRIPTION =
  "When a consumer calls the business and the call is not answered, the consumer may receive one immediate SMS response acknowledging the missed call. No additional automated messages are sent unless the consumer replies.";

const PRESS_1_CONSENT =
  "During the inbound call, the consumer hears an SMS disclosure and presses 1 to consent to receiving the missed-call follow-up message.";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  traceMctbDebug("setup", "get_start", { workspaceId, userId: session.userId });
  const { ensureMctbPlatformSenderDefault } = await import(
    "@/lib/mctb/ensure-platform-sender-default"
  );
  await ensureMctbPlatformSenderDefault(workspaceId).catch(() => undefined);
  const prisma = getPrisma();

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const customCfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbSettings =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const workspaceNumbersPromise = loadPhoneNumbers(workspaceId, { includeLinked: true });

  const [runtime, solution, phoneNumbers, compliance, reg, adminFlags, onboarding, productionForwardE164] =
    await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMissedCallTextBack(workspaceId),
    loadMctbSetupPhoneOptions(workspaceId),
    workspaceNumbersPromise.then((nums) => loadComplianceOverview(workspaceId, { phoneNumbers: nums })),
    workspaceNumbersPromise,
    loadAdminMctbTestFlags(workspaceId),
    loadMctbOnboardingState(workspaceId),
    getProductionMctbForwardTargetE164(workspaceId),
  ]);

  const requiredActions = deriveRequiredActions(compliance.registration, reg);
  const { resolveMctbWorkspaceBusinessLineE164 } = await import(
    "@/lib/mctb/resolve-workspace-business-line"
  );
  const businessLineE164 = resolveMctbWorkspaceBusinessLineE164(
    typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null,
    onboarding.businessNumberE164,
  );
  const phoneNumbersWithStatus = enrichWorkspacePhoneWithMessagingStatus(phoneNumbers);
  const messagingReady = isMctbSetupMessagingReady({
    phoneNumbers,
    requiredActions,
    adminFlags,
  });

  const setupMeta =
    solution?.config && typeof solution.config === "object"
      ? (solution.config as Record<string, unknown>)
      : {};

  const scheduleSettings = readMctbScheduleFromCustomFields(customCfg, runtime);
  const effectiveSchedule = previewMctbPauseState(scheduleSettings, runtime);
  const pauseKind = resolveMctbPauseKind(effectiveSchedule, runtime);
  const sanitizedPhoneNumberId = await sanitizeMctbSetupPhoneNumberId(
    workspaceId,
    runtime.phoneNumberId,
  );
  const sanitizedSmsPhoneNumberId = await sanitizeMctbSetupPhoneNumberId(
    workspaceId,
    runtime.smsPhoneNumberId,
  );
  let runtimeForClient =
    sanitizedPhoneNumberId !== runtime.phoneNumberId ||
    sanitizedSmsPhoneNumberId !== runtime.smsPhoneNumberId
      ? {
          ...runtime,
          phoneNumberId: sanitizedPhoneNumberId,
          smsPhoneNumberId: sanitizedSmsPhoneNumberId,
        }
      : runtime;

  const { readMctbPlatformRecoveryTemplateId } = await import(
    "@/lib/mctb/platform-template-persistence"
  );
  const { listMctbPlatformRecoveryOpenerChoices } = await import(
    "@/lib/mctb/platform-recovery-template-choices"
  );
  const platformRecoveryTemplateId = await readMctbPlatformRecoveryTemplateId(workspaceId);
  runtimeForClient = {
    ...runtimeForClient,
    platformRecoveryTemplateId,
  };
  if (runtimeForClient.senderMode === "PLATFORM") {
    runtimeForClient = {
      ...runtimeForClient,
      messageTemplate: resolveMctbRecoveryOpenerTemplate(runtimeForClient),
      messageTemplateBusinessHours: null,
      messageTemplateAfterHours: null,
    };
  }

  if (
    sanitizedPhoneNumberId &&
    (sanitizedPhoneNumberId !== runtime.phoneNumberId ||
      sanitizedSmsPhoneNumberId !== runtime.smsPhoneNumberId)
  ) {
    traceMctbDebug("setup", "stale_phone_repair", {
      workspaceId,
      beforePhoneNumberId: runtime.phoneNumberId,
      afterPhoneNumberId: sanitizedPhoneNumberId,
      beforeSmsPhoneNumberId: runtime.smsPhoneNumberId,
      afterSmsPhoneNumberId: sanitizedSmsPhoneNumberId,
    });
    void updateMissedCallTextConfig({
      workspaceId,
      patch: {
        phone_number_id: sanitizedPhoneNumberId,
        sms_phone_number_id: sanitizedSmsPhoneNumberId || sanitizedPhoneNumberId,
      },
      source: "mctb_setup_stale_phone_repair",
    }).catch((err) => {
      traceMctbDebugError("setup", "stale_phone_repair_failed", err, { workspaceId });
    });
  }

  const resolvedConsentMode = normalizeMctbConsentMode(
    mctbSettings.consentMode ??
      setupMeta.consentMode ??
      parseMctbOnboardingState(customCfg).consentMode,
  );

  traceMctbDebug("setup", "get_complete", {
    workspaceId,
    runtimePhoneNumberId: runtimeForClient.phoneNumberId,
    runtimeSmsPhoneNumberId: runtimeForClient.smsPhoneNumberId,
    consentMode: resolvedConsentMode,
    enabled: runtimeForClient.enabled,
    paused: isMctbSchedulePaused(effectiveSchedule, runtime),
    phoneOptions: summarizeMctbPhoneOptions(phoneNumbersWithStatus),
    messagingReady,
  });

  const { readMctbRecoveryGoalId } = await import("@/lib/mctb/apply-recovery-goal-config");
  const recoveryGoal = await readMctbRecoveryGoalId(workspaceId);
  const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
  const capabilities = await resolveMctbCapabilities(workspaceId);
  const paidEntitled = capabilities.recoveryPaid;
  const senderMode = runtimeForClient.senderMode || "WORKSPACE";
  const senderPresentation = describeMctbSenderPresentation(senderMode);
  const platformSenderActive = capabilities.platformSenderActive;

  return NextResponse.json({
    data: {
      capabilities,
      recoveryGoal,
      runtime: runtimeForClient,
      schedule: {
        scheduleMode: effectiveSchedule.scheduleMode,
        weeklySchedule: effectiveSchedule.weeklySchedule,
        pauseUntil: effectiveSchedule.pauseUntil,
        manuallyPaused: effectiveSchedule.manuallyPaused,
        pauseKind,
        paused: isMctbSchedulePaused(effectiveSchedule, runtime),
      },
      solution: solution
        ? {
            setupId: solution.setupId,
            flowId: solution.flowId,
            status: solution.status,
            config: solution.config,
          }
        : null,
      phoneNumbers: phoneNumbersWithStatus,
      compliance: {
        messagingReady,
        requiredActions,
        phoneSummary: phoneNumbersSummary(reg),
        tollFreeSummary: tollFreeSummary(reg),
        brandStatus: compliance.registration?.brandStatus || "Not started",
        campaignStatus: compliance.registration?.campaignStatus || "Not started",
      },
      adminTest: {
        isPlatformAdmin: session.isAdmin,
        isAdminTestWorkspace:
          adminFlags.adminTestAccount ||
          adminFlags.unlimitedMctbTesting ||
          adminFlags.adminUnlimitedMctb,
        canBootstrap: session.isAdmin,
        productionForwardTargetE164: productionForwardE164,
        businessLineE164,
      },
      prefills: {
        campaignDescription: DEFAULT_CAMPAIGN_DESCRIPTION,
        press1Consent: PRESS_1_CONSENT,
      },
      consentMode: resolvedConsentMode,
      consentMeta: {
        paidEntitled,
        existingConsentEligible: isExistingConsentModeEligible({
          messagingReady,
          platformSenderActive,
          mctbProductActive: capabilities.pressOneConsent,
        }),
        existingConsentAttestation: (() => {
          const raw = mctbSettings.existingConsentAttestation;
          if (!raw || typeof raw !== "object") return null;
          const row = raw as Record<string, unknown>;
          if (row.accepted !== true) return null;
          return {
            attestedAt: String(row.attestedAt || ""),
            attestedByUserId: String(row.attestedByUserId || ""),
            version: String(row.version || EXISTING_CONSENT_ATTESTATION_VERSION),
          };
        })(),
      },
      productionForwardTargetE164: productionForwardE164,
      businessLineE164,
      messaging: {
        senderMode,
        ...senderPresentation,
        canEditRecoveryOpener: senderMode !== "PLATFORM",
        platformRecoveryTemplateId,
        platformRecoveryOpenerChoices: listMctbPlatformRecoveryOpenerChoices(),
      },
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const body = (await req.json().catch(() => ({}))) as MctbSetupPayload;
  const prisma = getPrisma();
  const priorRuntime = await loadMissedCallTextConfig(workspaceId);
  const previousPhoneId = priorRuntime.phoneNumberId;

  if (priorRuntime.senderMode === "PLATFORM" && body.messageTemplate !== undefined) {
    delete body.messageTemplate;
    delete body.messageTemplateBusinessHours;
    delete body.messageTemplateAfterHours;
  }

  if (body.platformRecoveryTemplateId !== undefined) {
    if (priorRuntime.senderMode !== "PLATFORM") {
      return NextResponse.json(
        { error: "Platform recovery templates apply only when using the Transovo platform sender." },
        { status: 400 },
      );
    }
    const { writeMctbPlatformRecoveryTemplateId } = await import(
      "@/lib/mctb/platform-template-persistence"
    );
    try {
      await writeMctbPlatformRecoveryTemplateId(
        workspaceId,
        body.platformRecoveryTemplateId as import("@/lib/mctb/platform-message-templates").MctbPlatformTemplateId,
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid platform template." },
        { status: 400 },
      );
    }
    delete body.platformRecoveryTemplateId;
  }

  traceMctbDebug("setup", "post_start", {
    workspaceId,
    userId: session.userId,
    previousPhoneNumberId: previousPhoneId,
    requestedPhoneNumberId: body.phoneNumberId ?? null,
    requestedSmsPhoneNumberId: body.smsPhoneNumberId ?? null,
    consentMode: body.consentMode ?? null,
    activate: body.activate ?? null,
    enabled: body.enabled ?? null,
    pauseUntil: body.pauseUntil ?? null,
  });

  const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
  const setupCapabilities = await resolveMctbCapabilities(workspaceId);
  const bookingFieldsRequested =
    body.defaultLinkUrl !== undefined ||
    body.requestFormEnabled !== undefined ||
    body.leadCaptureEnabled !== undefined ||
    body.requestFormFieldsJson !== undefined;
  if (bookingFieldsRequested && !setupCapabilities.bookingLinks) {
    return NextResponse.json(
      {
        error:
          "Booking links and request forms require a Text Back or AI Recovery plan. Upgrade in Billing.",
      },
      { status: 403 },
    );
  }

  if (body.recoveryGoal) {
    const { parseRecoveryGoalId } = await import("@/lib/mctb/recovery-goals");
    const { applyMctbRecoveryGoalConfiguration } = await import(
      "@/lib/mctb/apply-recovery-goal-config"
    );
    const goalId = parseRecoveryGoalId(body.recoveryGoal);
    if (goalId) {
      await applyMctbRecoveryGoalConfiguration({
        workspaceId,
        goalId,
        actorUserId: session.userId,
        messageOverride: body.messageTemplate ?? null,
      });
    }
  }

  if (body.phoneNumberId !== undefined && body.phoneNumberId !== null) {
    const requestedPhoneId = body.phoneNumberId;
    const canonicalPhoneId = await resolveCanonicalMctbSetupPhoneId(
      workspaceId,
      body.phoneNumberId,
    );
    if (!canonicalPhoneId) {
      traceMctbDebug("setup", "phone_rejected", {
        workspaceId,
        requestedPhoneNumberId: requestedPhoneId,
      });
      return NextResponse.json(
        { error: "Selected number is not available for this workspace." },
        { status: 400 },
      );
    }
    if (canonicalPhoneId !== requestedPhoneId) {
      traceMctbDebug("setup", "phone_canonicalized", {
        workspaceId,
        requestedPhoneNumberId: requestedPhoneId,
        canonicalPhoneNumberId: canonicalPhoneId,
      });
    }
    body.phoneNumberId = canonicalPhoneId;
  }

  if (body.smsPhoneNumberId !== undefined && body.smsPhoneNumberId !== null) {
    const canonicalSmsId = await resolveCanonicalMctbSetupPhoneId(
      workspaceId,
      body.smsPhoneNumberId,
    );
    if (!canonicalSmsId) {
      return NextResponse.json(
        { error: "Selected SMS number is not available for this workspace." },
        { status: 400 },
      );
    }
    body.smsPhoneNumberId = canonicalSmsId;
  }

  if (body.senderMode !== undefined) {
    const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
    const caps = await resolveMctbCapabilities(workspaceId);
    const requested = body.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
    if (requested === "WORKSPACE") {
      if (!caps.ownSenderAddOnEntitled) {
        return NextResponse.json(
          { error: "Own Sender add-on is required to send from your verified number." },
          { status: 403 },
        );
      }
      const smsId =
        body.smsPhoneNumberId ?? priorRuntime.smsPhoneNumberId ?? priorRuntime.phoneNumberId;
      if (!smsId) {
        return NextResponse.json(
          { error: "Select a verified messaging number for customer-owned sending." },
          { status: 400 },
        );
      }
      const phoneNumbersForSender = await loadMctbSetupPhoneOptions(workspaceId);
      const row = phoneNumbersForSender.find((p) => p.id === smsId);
      if (!row) {
        return NextResponse.json({ error: "Selected sender is not in this workspace." }, { status: 400 });
      }
      const ms = getPhoneMessagingStatus(row);
      if (!ms.approved) {
        return NextResponse.json(
          { error: "Selected sender is not verified for messaging yet." },
          { status: 400 },
        );
      }
      if (smsId === priorRuntime.phoneNumberId) {
        return NextResponse.json(
          {
            error:
              "Your Transovo forwarding number cannot be used as the text-back sender. Choose your approved messaging number.",
          },
          { status: 400 },
        );
      }
      body.smsPhoneNumberId = smsId;
    }
  }

  const sessionUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { phone: true },
  });
  const businessLineForBinding =
    body.businessLineE164?.trim() ||
    sessionUser?.phone?.trim() ||
    null;

  const pauseMutation = buildMctbPauseMutation({
    enabled: body.enabled,
    pauseUntil: body.pauseUntil,
  });
  const pausing = isMctbSetupPausing(body);
  const enabledPatch =
    pauseMutation !== null
      ? pauseMutation.enabled
      : body.enabled !== undefined
        ? body.enabled
        : undefined;

  if (
    body.consentMode === "existing_consent" &&
    body.existingConsentAttested !== true
  ) {
    return NextResponse.json(
      { error: "Existing consent attestation is required" },
      { status: 400 },
    );
  }

  if (body.consentMode === "existing_consent") {
    const { resolveMctbCapabilities: resolveCapsForEligibility } = await import(
      "@/lib/mctb/capabilities"
    );
    const [phoneNumbersForConsent, complianceForConsent, regForConsent, adminFlagsForConsent, capsForConsent] =
      await Promise.all([
        loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
        loadComplianceOverview(workspaceId),
        loadPhoneNumbers(workspaceId, { includeLinked: true }),
        loadAdminMctbTestFlags(workspaceId),
        resolveCapsForEligibility(workspaceId),
      ]);
    const requiredForConsent = deriveRequiredActions(
        complianceForConsent.registration,
        regForConsent,
      );
      if (
        !isExistingConsentModeEligible({
          messagingReady: isMctbSetupMessagingReady({
            phoneNumbers: phoneNumbersForConsent,
            requiredActions: requiredForConsent,
            adminFlags: adminFlagsForConsent,
          }),
          platformSenderActive: capsForConsent.platformSenderActive,
          mctbProductActive: capsForConsent.pressOneConsent,
        })
    ) {
      return NextResponse.json(
        {
          error:
            "Existing permission with your own number requires approved messaging on that number, or switch to Transovo platform sender.",
        },
        { status: 400 },
      );
    }
  }

  if (body.activate === true && body.phoneNumberId) {
    const [phoneNumbers, compliance, reg, adminFlags] = await Promise.all([
      loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
      loadComplianceOverview(workspaceId),
      loadPhoneNumbers(workspaceId, { includeLinked: true }),
      loadAdminMctbTestFlags(workspaceId),
    ]);
    const requiredActions = deriveRequiredActions(compliance.registration, reg);
    if (
      !isMctbSetupMessagingReady({
        phoneNumbers,
        requiredActions,
        adminFlags,
      })
    ) {
      return NextResponse.json(
        { error: "Messaging setup is incomplete for the selected number (A2P approval required)." },
        { status: 400 },
      );
    }
  }

  const scheduleModePatch =
    body.scheduleMode ??
    (body.triggerRules?.afterHours === true
      ? "after_hours"
      : body.triggerRules?.afterHours === false
        ? "always_on"
        : undefined);

  const phoneNumberChanged =
    body.phoneNumberId !== undefined && body.phoneNumberId !== previousPhoneId;
  if (phoneNumberChanged) {
    traceMctbDebug("setup", "phone_switch", {
      workspaceId,
      fromPhoneNumberId: previousPhoneId,
      toPhoneNumberId: body.phoneNumberId ?? null,
      activate: body.activate ?? null,
    });
  }
  const smsPhoneNumberIdForPatch =
    body.smsPhoneNumberId !== undefined
      ? body.smsPhoneNumberId
      : phoneNumberChanged && body.phoneNumberId !== undefined
        ? body.phoneNumberId
        : undefined;

  const runtimeResult = await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      ...(body.senderMode !== undefined
        ? { sender_mode: body.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE" }
        : {}),
      ...(enabledPatch !== undefined ? { enabled: enabledPatch } : {}),
      delay_seconds: body.delaySeconds,
      initial_message: body.messageTemplate,
      message_template_business_hours: body.messageTemplateBusinessHours,
      message_template_after_hours: body.messageTemplateAfterHours,
      phone_number_id: body.phoneNumberId,
      ...(smsPhoneNumberIdForPatch !== undefined
        ? { sms_phone_number_id: smsPhoneNumberIdForPatch }
        : {}),
      cooldown_minutes: body.cooldownMinutes,
      max_messages_per_caller: body.maxMessagesPerCaller,
      trigger_rules: body.triggerRules
        ? {
            no_answer: body.triggerRules.noAnswer,
            busy: body.triggerRules.busy,
            rejected: body.triggerRules.rejected,
            timeout: body.triggerRules.timeout,
            voicemail: body.triggerRules.voicemail,
          }
        : undefined,
      quiet_hours: body.businessHoursOnly
        ? {
            enabled: true,
            start: body.allowedStartTime || undefined,
            end: body.allowedEndTime || undefined,
          }
        : undefined,
      direct_dial_forward_e164: body.directDialForwardE164,
      default_link_url: body.defaultLinkUrl,
      request_form_enabled: body.requestFormEnabled,
      lead_capture_enabled: body.leadCaptureEnabled,
      request_form_fields_json: body.requestFormFieldsJson,
    },
    actor: session.userId,
    source: "mctb_setup_page",
  });

  if (
    body.businessHoursOnly !== undefined ||
    body.allowedStartTime !== undefined ||
    body.allowedEndTime !== undefined ||
    body.timezone !== undefined
  ) {
    await prisma.missedCallTextConfig.update({
      where: { workspaceId },
      data: {
        ...(body.businessHoursOnly !== undefined
          ? { businessHoursOnly: body.businessHoursOnly }
          : {}),
        ...(body.allowedStartTime !== undefined
          ? { allowedStartTime: body.allowedStartTime }
          : {}),
        ...(body.allowedEndTime !== undefined
          ? { allowedEndTime: body.allowedEndTime }
          : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      },
    });
  }

  const existing = await loadMissedCallTextBack(workspaceId);
  const baseConfig = (existing?.config || {}) as MissedCallTextBackConfig;
  const solutionConfig: MissedCallTextBackConfig & {
    consentMode?: MctbConsentMode;
    replyNotifications?: boolean;
  } = {
    ...baseConfig,
    phoneNumberId: body.phoneNumberId ?? baseConfig.phoneNumberId,
    firstMessage: body.messageTemplate ?? baseConfig.firstMessage,
    initialDelaySeconds: body.delaySeconds ?? baseConfig.initialDelaySeconds ?? 0,
    consentMode: body.consentMode ?? (baseConfig as { consentMode?: MctbConsentMode }).consentMode,
    replyNotifications: body.replyNotifications,
    activate: body.activate ?? !pausing,
  };

  const saved = await saveMissedCallTextBack(workspaceId, {
    ...solutionConfig,
    setupId: existing?.setupId || undefined,
    activate: body.activate ?? !pausing,
  });

  let sipProvision: { ok: boolean; actions?: string[]; error?: string } | null = null;
  let consentSync: { ok: boolean; action?: string; error?: string } | null = null;
  let attestation: { ok: boolean; error?: string } | null = null;
  const phoneId = body.phoneNumberId ?? runtimeResult.config.phoneNumberId;

  // Carrier: keep all workspace numbers dual-wired. Switching active DID is config-only.
  if (phoneNumberChanged && previousPhoneId) {
    const { ensureDefaultTelnyxMctbAndSmsProvision } = await import(
      "@/lib/mctb/provisioning/dual-channel-repair"
    );
    void ensureDefaultTelnyxMctbAndSmsProvision({
      workspaceId,
      phoneNumberId: previousPhoneId,
    }).catch((err) => {
      traceMctbDebugError("setup", "heal_previous_number_failed", err, {
        workspaceId,
        phoneNumberId: previousPhoneId,
      });
    });
  }

  if (phoneId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneId, workspaceId },
      select: { id: true, provider: true },
    });
    if (pn && String(pn.provider || "").toLowerCase() === "telnyx") {
      try {
        const { ensureDefaultTelnyxMctbAndSmsProvision } = await import(
          "@/lib/mctb/provisioning/dual-channel-repair"
        );
        await ensureDefaultTelnyxMctbAndSmsProvision({
          workspaceId,
          phoneNumberId: pn.id,
        });
        sipProvision = { ok: true, actions: ["carrier_dual_channel_mctb_sms"] };
        traceMctbDebug("setup", "sip_provision_ok", {
          workspaceId,
          phoneNumberId: pn.id,
          actions: sipProvision.actions,
        });

        if (body.activate === true) {
          const { activateJohnOnPhoneNumber } = await import(
            "@/lib/agents/missed-call-text-back/phone-switch"
          );
          await activateJohnOnPhoneNumber({
            workspaceId,
            phoneNumberId: pn.id,
            smsPhoneNumberId: phoneId,
            delaySeconds: body.delaySeconds,
            messageTemplate: body.messageTemplate,
            skipGenericVoiceProvision: true,
            activate: true,
          });
          sipProvision.actions?.push("mctb_runtime_activated");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sipProvision = { ok: false, error: message || "carrier_dual_channel_failed" };
        traceMctbDebugError("setup", "sip_provision_failed", err, {
          workspaceId,
          phoneNumberId: pn.id,
        });
      }
    }
  }

  if (
    body.consentMode ||
    body.replyNotifications !== undefined ||
    body.businessLineE164 !== undefined ||
    body.scheduleMode !== undefined ||
    body.weeklySchedule !== undefined ||
    body.pauseUntil !== undefined ||
    body.enabled !== undefined ||
    body.triggerRules?.afterHours !== undefined ||
    pauseMutation !== null
  ) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    });
    const customCfg =
      ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
        ? (ws.customFieldsConfig as Record<string, unknown>)
        : {};
    const mctb =
      customCfg.mctb && typeof customCfg.mctb === "object"
        ? (customCfg.mctb as Record<string, unknown>)
        : {};

    if (scheduleModePatch !== undefined) {
      mctb.scheduleMode = scheduleModePatch;
    }

    if (body.businessLineE164?.trim()) {
      const { saveMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
      await saveMctbOnboardingState(workspaceId, {
        businessNumberE164: body.businessLineE164.trim(),
        forwardingConnectedAt: new Date().toISOString(),
      });
    }

    const wsFresh = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customFieldsConfig: true },
    });
    const customCfgFresh =
      wsFresh?.customFieldsConfig && typeof wsFresh.customFieldsConfig === "object"
        ? (wsFresh.customFieldsConfig as Record<string, unknown>)
        : customCfg;
    const mctbFresh =
      customCfgFresh.mctb && typeof customCfgFresh.mctb === "object"
        ? (customCfgFresh.mctb as Record<string, unknown>)
        : mctb;
    if (scheduleModePatch !== undefined) {
      mctbFresh.scheduleMode = scheduleModePatch;
    }
    const onboardingFresh = parseMctbOnboardingState(customCfgFresh);
    const onboardingNext =
      body.consentMode
        ? { ...onboardingFresh, consentMode: body.consentMode }
        : onboardingFresh;

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customFieldsConfig: {
          ...customCfgFresh,
          ...(body.consentMode
            ? { mctbOnboarding: JSON.parse(JSON.stringify(onboardingNext)) }
            : {}),
          mctb: {
            ...mctbFresh,
            ...(body.consentMode ? { consentMode: body.consentMode } : {}),
            ...(body.replyNotifications !== undefined
              ? { replyNotifications: body.replyNotifications }
              : {}),
            ...(body.businessLineE164 !== undefined
              ? { businessLineE164: body.businessLineE164?.trim() || null }
              : businessLineForBinding
                ? { businessLineE164: businessLineForBinding }
                : {}),
            ...(body.scheduleMode !== undefined ? { scheduleMode: body.scheduleMode } : {}),
            ...(scheduleModePatch !== undefined && body.scheduleMode === undefined
              ? { scheduleMode: scheduleModePatch }
              : {}),
            ...(body.weeklySchedule !== undefined
              ? { weeklySchedule: body.weeklySchedule }
              : {}),
            ...(pauseMutation
              ? {
                  pauseUntil: pauseMutation.pauseUntil,
                  manuallyPaused: pauseMutation.manuallyPaused,
                }
              : body.pauseUntil !== undefined
                ? { pauseUntil: body.pauseUntil }
                : {}),
          },
        },
      },
    });

    if (body.scheduleMode !== undefined || scheduleModePatch !== undefined) {
      await prisma.missedCallTextConfig.update({
        where: { workspaceId },
        data: {
          businessHoursOnly:
            (body.scheduleMode ?? scheduleModePatch) === "business_hours",
        },
      });
    }

    if (body.consentMode || phoneId) {
      const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
      const { warmMctbInboundRoutingProfileForWorkspace } = await import(
        "@/lib/mctb/texml-ingress/routing-profile"
      );
      const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
        "@/lib/mctb/texml-ingress/texml-mode-provision"
      );
      try {
        const syncResult = await syncMctbConsentRouting(workspaceId, session.userId, {
          assignedPhoneNumberId: phoneId ?? undefined,
        });
        consentSync = { ok: true, action: syncResult.action };
        traceMctbDebug("setup", "consent_sync_ok", {
          workspaceId,
          action: syncResult.action,
          phoneNumberId: phoneId,
        });
        if (phoneId) {
          await provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, phoneId);
        }
        await warmMctbInboundRoutingProfileForWorkspace(workspaceId);
      } catch (err) {
        consentSync = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
        traceMctbDebugError("setup", "consent_sync_failed", err, {
          workspaceId,
          phoneNumberId: phoneId,
        });
      }
    }

    if (body.consentMode === "existing_consent") {
      const { recordWorkspaceExistingConsentAttestation } = await import(
        "@/lib/mctb/capture/attestation"
      );
      try {
        await recordWorkspaceExistingConsentAttestation({
          workspaceId,
          attestedByUserId: session.userId,
        });
        attestation = { ok: true };
      } catch (err) {
        attestation = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const { ensureMctbTenantProductionBinding } = await import(
    "@/lib/mctb/tenant-production-binding"
  );
  const tenantBinding = await ensureMctbTenantProductionBinding({
    workspaceId,
    userEmail: session.email,
    phoneNumberId: body.phoneNumberId ?? runtimeResult.config.phoneNumberId,
    businessLineE164: businessLineForBinding,
  });

  if (sipProvision?.ok && phoneId) {
    const { pauseLegacyMctbSmartRoutingFlows } = await import(
      "@/lib/mctb/consent-prompt/service"
    );
    await pauseLegacyMctbSmartRoutingFlows(workspaceId, {
      activePhoneNumberId: phoneId,
    }).catch(() => undefined);
  }

  const wsAfter = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const scheduleAfter = readMctbScheduleFromCustomFields(
    wsAfter?.customFieldsConfig,
    runtimeResult.config,
  );
  const normalizedAfter = normalizeMctbPauseState(scheduleAfter, runtimeResult.config);
  const pauseKind = resolveMctbPauseKind(normalizedAfter.settings, runtimeResult.config);

  traceMctbDebug("setup", "post_complete", {
    workspaceId,
    phoneNumberId: runtimeResult.config.phoneNumberId,
    smsPhoneNumberId: runtimeResult.config.smsPhoneNumberId,
    phoneNumberChanged,
    sipProvision,
    tenantBinding,
    consentSync,
    attestation,
    paused: isMctbSchedulePaused(normalizedAfter.settings, runtimeResult.config),
    pauseKind,
    debugEnabled: isMctbDebugEnabled(),
  });

  return NextResponse.json({
    ok: true,
    data: {
      runtime: runtimeResult.config,
      schedule: {
        paused: isMctbSchedulePaused(normalizedAfter.settings, runtimeResult.config),
        pauseKind,
        pauseUntil: normalizedAfter.settings.pauseUntil,
        manuallyPaused: normalizedAfter.settings.manuallyPaused,
      },
      solution: saved,
      sipProvision,
      tenantBinding,
      consentSync,
      attestation,
    },
  });
}
