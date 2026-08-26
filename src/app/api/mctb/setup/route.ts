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
  loadWorkspaceAccessiblePhoneNumbers,
} from "@/lib/numbers/workspace-accessible-numbers";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import {
  getPlatformDemoPhoneRecord,
  isWorkspaceAuthorizedForPlatformDemoNumber,
} from "@/lib/mctb/platform-demo-access";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import {
  defaultWeeklySchedule,
  readMctbScheduleFromCustomFields,
  isMctbSchedulePaused,
} from "@/lib/mctb/schedule";

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
  replyNotifications?: boolean;
  directDialForwardE164?: string | null;
  defaultLinkUrl?: string | null;
  requestFormEnabled?: boolean;
  leadCaptureEnabled?: boolean;
  activate?: boolean;
  existingConsentAttested?: boolean;
};

const DEFAULT_CAMPAIGN_DESCRIPTION =
  "When a consumer calls the business and the call is not answered, the consumer may receive one immediate SMS response acknowledging the missed call. No additional automated messages are sent unless the consumer replies.";

const PRESS_1_CONSENT =
  "During the inbound call, the consumer hears an SMS disclosure and presses 1 to consent to receiving the missed-call follow-up message.";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
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

  const [runtime, solution, phoneNumbers, compliance, reg, adminFlags, onboarding, productionForwardE164] =
    await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    loadMissedCallTextBack(workspaceId),
    loadWorkspaceAccessiblePhoneNumbers(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
    loadAdminMctbTestFlags(workspaceId),
    loadMctbOnboardingState(workspaceId),
    getProductionMctbForwardTargetE164(workspaceId),
  ]);

  const requiredActions = deriveRequiredActions(compliance.registration, reg);
  const platformDemoAuthorized = await isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId);
  const platformDemoPhone = platformDemoAuthorized ? await getPlatformDemoPhoneRecord() : null;
  const businessLineE164 =
    (typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null) ||
    onboarding.businessNumberE164 ||
    null;
  const phoneNumbersWithStatus = enrichWorkspacePhoneWithMessagingStatus(
    phoneNumbers,
    platformDemoPhone?.phoneNumberId,
  );
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

  return NextResponse.json({
    data: {
      runtime,
      schedule: {
        scheduleMode: scheduleSettings.scheduleMode,
        weeklySchedule: scheduleSettings.weeklySchedule,
        pauseUntil: scheduleSettings.pauseUntil,
        paused: isMctbSchedulePaused(scheduleSettings, runtime),
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
        platformDemoLinked: platformDemoAuthorized,
        canBootstrap: session.isAdmin,
        productionForwardTargetE164: productionForwardE164,
        businessLineE164,
      },
      prefills: {
        campaignDescription: DEFAULT_CAMPAIGN_DESCRIPTION,
        press1Consent: PRESS_1_CONSENT,
      },
      consentMode:
        (mctbSettings.consentMode as MctbConsentMode | undefined) ||
        (setupMeta.consentMode as MctbConsentMode | undefined) ||
        "press_1",
      productionForwardTargetE164: productionForwardE164,
      businessLineE164,
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const body = (await req.json().catch(() => ({}))) as MctbSetupPayload;
  const prisma = getPrisma();

  const runtimeResult = await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: body.enabled,
      delay_seconds: body.delaySeconds,
      initial_message: body.messageTemplate,
      message_template_business_hours: body.messageTemplateBusinessHours,
      message_template_after_hours: body.messageTemplateAfterHours,
      phone_number_id: body.phoneNumberId,
      sms_phone_number_id: body.smsPhoneNumberId,
      cooldown_minutes: body.cooldownMinutes,
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
    consentMode: body.consentMode,
    replyNotifications: body.replyNotifications,
    activate: body.activate ?? true,
  };

  const saved = await saveMissedCallTextBack(workspaceId, {
    ...solutionConfig,
    setupId: existing?.setupId || undefined,
    activate: body.activate ?? true,
  });

  let sipProvision: { ok: boolean; actions?: string[]; error?: string } | null = null;
  const phoneId = body.phoneNumberId ?? runtimeResult.config.phoneNumberId;
  if (phoneId) {
    let pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneId, workspaceId },
      select: { id: true, provider: true },
    });
    if (!pn) {
      const authorized = await isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId);
      const demo = authorized ? await getPlatformDemoPhoneRecord() : null;
      if (demo?.phoneNumberId === phoneId) {
        pn = await prisma.phoneNumber.findFirst({
          where: { id: phoneId },
          select: { id: true, provider: true },
        });
      }
    }
    if (pn && String(pn.provider || "").toLowerCase() === "telnyx") {
      const { provisionMctbTelnyxSipIngress } = await import(
        "@/lib/mctb/provisioning/telnyx-sip-ingress"
      );
      sipProvision = await provisionMctbTelnyxSipIngress({
        workspaceId,
        phoneNumberId: pn.id,
        messageTemplate: body.messageTemplate,
        delaySeconds: body.delaySeconds,
      });
    }
  }

  if (
    body.consentMode ||
    body.replyNotifications !== undefined ||
    body.businessLineE164 !== undefined ||
    body.scheduleMode !== undefined ||
    body.weeklySchedule !== undefined ||
    body.pauseUntil !== undefined
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

    if (body.consentMode) {
      if (
        body.consentMode === "existing_consent" &&
        body.existingConsentAttested !== true
      ) {
        return NextResponse.json(
          { error: "Existing consent attestation is required" },
          { status: 400 },
        );
      }
    }

    if (body.businessLineE164?.trim()) {
      const { saveMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
      await saveMctbOnboardingState(workspaceId, {
        businessNumberE164: body.businessLineE164.trim(),
        forwardingConnectedAt: new Date().toISOString(),
      });
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customFieldsConfig: {
          ...customCfg,
          mctb: {
            ...mctb,
            ...(body.consentMode ? { consentMode: body.consentMode } : {}),
            ...(body.replyNotifications !== undefined
              ? { replyNotifications: body.replyNotifications }
              : {}),
            ...(body.businessLineE164 !== undefined
              ? { businessLineE164: body.businessLineE164?.trim() || null }
              : {}),
            ...(body.scheduleMode !== undefined ? { scheduleMode: body.scheduleMode } : {}),
            ...(body.weeklySchedule !== undefined
              ? { weeklySchedule: body.weeklySchedule }
              : {}),
            ...(body.pauseUntil !== undefined ? { pauseUntil: body.pauseUntil } : {}),
          },
        },
      },
    });

    if (body.scheduleMode !== undefined) {
      await prisma.missedCallTextConfig.update({
        where: { workspaceId },
        data: { businessHoursOnly: body.scheduleMode === "business_hours" },
      });
    }

    if (body.consentMode) {
      const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
      await syncMctbConsentRouting(workspaceId, session.userId).catch(() => undefined);

      if (body.consentMode === "existing_consent") {
        const { recordWorkspaceExistingConsentAttestation } = await import(
          "@/lib/mctb/event-only/attestation"
        );
        await recordWorkspaceExistingConsentAttestation({
          workspaceId,
          attestedByUserId: session.userId,
        }).catch(() => undefined);
      }

      const { syncPlatformDemoConsentRuntime } = await import(
        "@/lib/mctb/onboarding/platform-demo"
      );
      await syncPlatformDemoConsentRuntime(body.consentMode).catch((err) => {
        console.error("[mctb/setup] syncPlatformDemoConsentRuntime", err);
      });
    }
  }

  const { ensureMctbTenantProductionBinding } = await import(
    "@/lib/mctb/tenant-production-binding"
  );
  const tenantBinding = await ensureMctbTenantProductionBinding({
    workspaceId,
    userEmail: session.email,
    phoneNumberId: body.phoneNumberId ?? runtimeResult.config.phoneNumberId,
    businessLineE164: body.businessLineE164,
  });

  return NextResponse.json({
    ok: true,
    data: {
      runtime: runtimeResult.config,
      solution: saved,
      sipProvision,
      tenantBinding,
    },
  });
}
