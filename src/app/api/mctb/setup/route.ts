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
import { getPhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import {
  getPlatformDemoPhoneRecord,
  isWorkspaceAuthorizedForPlatformDemoNumber,
} from "@/lib/mctb/platform-demo-access";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";

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
  delaySeconds?: number;
  consentMode?: MctbConsentMode;
  businessLineE164?: string | null;
  businessHoursOnly?: boolean;
  allowedStartTime?: string | null;
  allowedEndTime?: string | null;
  timezone?: string;
  cooldownMinutes?: number;
  replyNotifications?: boolean;
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
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      orderBy: { e164: "asc" },
      select: {
        id: true,
        e164: true,
        friendlyName: true,
        type: true,
        a2pStatus: true,
        status: true,
        settingsJson: true,
      },
    }),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId),
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
  const mergedPhoneNumbers =
    platformDemoPhone &&
    !phoneNumbers.some((n: { id: string }) => n.id === platformDemoPhone.phoneNumberId)
      ? [
          ...phoneNumbers,
          {
            id: platformDemoPhone.phoneNumberId,
            e164: platformDemoPhone.e164,
            friendlyName: formatMctbPhoneLabel(platformDemoPhone.e164),
            type: "local",
            a2pStatus: "APPROVED",
            status: "Active",
            settingsJson: {
              ...platformDemoPhone.settingsJson,
              ...telnyxLocalA2pSettings({
                role: "customer_production",
                a2pApproved: true,
              }),
            },
          },
        ]
      : phoneNumbers;
  const phoneNumbersWithStatus = mergedPhoneNumbers.map(
    (n: {
      id: string;
      e164: string;
      friendlyName: string | null;
      type?: string | null;
      a2pStatus?: string | null;
      status?: string | null;
      settingsJson?: unknown;
    }) => {
      const isLinkedProductionDid =
        platformDemoPhone && n.id === platformDemoPhone.phoneNumberId;
      const row = isLinkedProductionDid
        ? {
            ...n,
            a2pStatus: "APPROVED",
            settingsJson: {
              ...(n.settingsJson && typeof n.settingsJson === "object" && !Array.isArray(n.settingsJson)
                ? (n.settingsJson as Record<string, unknown>)
                : {}),
              ...telnyxLocalA2pSettings({
                role: "customer_production",
                a2pApproved: true,
              }),
            },
          }
        : n;
      return {
        ...row,
        messagingStatus: getPhoneMessagingStatus(row),
      };
    },
  );
  const messagingReady = isMctbSetupMessagingReady({
    phoneNumbers: mergedPhoneNumbers,
    requiredActions,
    adminFlags,
  });

  const setupMeta =
    solution?.config && typeof solution.config === "object"
      ? (solution.config as Record<string, unknown>)
      : {};

  return NextResponse.json({
    data: {
      runtime,
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

  if (body.consentMode || body.replyNotifications !== undefined || body.businessLineE164 !== undefined) {
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
          },
        },
      },
    });

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

  return NextResponse.json({
    ok: true,
    data: {
      runtime: runtimeResult.config,
      solution: saved,
      sipProvision,
    },
  });
}
