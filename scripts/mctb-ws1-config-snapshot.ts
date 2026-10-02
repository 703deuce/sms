/**
 * Read-only authoritative ws_1 MCTB config for browser-cert verification (not UI mutation).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-ws1-config-snapshot.ts
 */
import { getPrisma } from "@/lib/db";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  isMctbAutomationActive,
  isMctbSchedulePaused,
  loadMctbScheduleSettings,
  resolveMctbPauseKind,
} from "@/lib/mctb/schedule";
import { resolveMctbTexmlHandlerMode } from "@/lib/mctb/texml-ingress/texml-mode-provision";
import { loadLeadRecoveryConfigPersisted } from "@/lib/mctb/lead-recovery/config";
import { deriveSimplifiedFieldEnabled } from "@/lib/mctb/ai-recovery/simplified-fields";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CERT_EXCLUSION_E164 = "+15550119999";

async function main() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { id: true, name: true, customFieldsConfig: true },
  });
  if (!ws) {
    console.error(JSON.stringify({ error: "workspace_not_found", workspaceId: WORKSPACE_ID }));
    process.exit(1);
  }
  const cfg =
    ws.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const onboarding = parseMctbOnboardingState(cfg);
  const consentMode = await loadMctbConsentMode(WORKSPACE_ID);
  const runtime = await loadMissedCallTextConfig(WORKSPACE_ID);
  const schedule = await loadMctbScheduleSettings(WORKSPACE_ID, runtime);
  const automationActive = isMctbAutomationActive(schedule, runtime);
  const pauseKind = resolveMctbPauseKind(schedule, runtime);
  const recoveryPaused = isMctbSchedulePaused(schedule, runtime);
  const texmlHandlerMode = resolveMctbTexmlHandlerMode({
    consentMode,
    automationActive,
  });

  let phoneTexmlHandlerMode: string | null = null;
  const phoneId = runtime?.phoneNumberId;
  if (phoneId) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: phoneId, workspaceId: WORKSPACE_ID },
      select: { settingsJson: true },
    });
    const settings =
      phone?.settingsJson && typeof phone.settingsJson === "object"
        ? (phone.settingsJson as Record<string, unknown>)
        : {};
    const inbound =
      settings.mctbInbound && typeof settings.mctbInbound === "object"
        ? (settings.mctbInbound as Record<string, unknown>)
        : {};
    if (typeof inbound.texmlHandlerMode === "string") {
      phoneTexmlHandlerMode = inbound.texmlHandlerMode;
    }
  }

  const exclusionCount = await prisma.suppression.count({
    where: {
      workspaceId: WORKSPACE_ID,
      source: "mctb_exclusion",
    },
  });

  const certExclusion = await prisma.suppression.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      source: "mctb_exclusion",
      phone: CERT_EXCLUSION_E164,
    },
    select: { id: true },
  });

  const handoffRow = await prisma.mctbHandoffConfig.findUnique({
    where: { workspaceId: WORKSPACE_ID },
    select: {
      emergencyDetectionEnabled: true,
      emergencyCriteria: true,
    },
  });
  const handoffRecipients = await prisma.mctbNotificationRecipient.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, email: true, name: true },
  });

  const leadRecovery = await loadLeadRecoveryConfigPersisted(WORKSPACE_ID);
  const aiFieldToggles = deriveSimplifiedFieldEnabled(leadRecovery.collectCapabilities ?? []);

  let voicemailGreetingText: string | null = null;
  let voicemailBoxId: string | null = null;
  if (runtime?.phoneNumberId) {
    const box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: WORKSPACE_ID, phoneNumberId: runtime.phoneNumberId },
      select: { id: true, greetingText: true },
      orderBy: { createdAt: "asc" },
    });
    voicemailBoxId = box?.id ?? null;
    voicemailGreetingText = box?.greetingText?.trim() || null;
  }

  const onboardingState = onboarding;

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        workspaceId: WORKSPACE_ID,
        workspaceName: ws.name,
        persisted: {
          mctbConsentMode: normalizeMctbConsentMode(mctb.consentMode),
          onboardingConsentMode: normalizeMctbConsentMode(onboarding.consentMode),
          existingConsentAttestation: mctb.existingConsentAttestation ?? null,
          pauseUntil: schedule.pauseUntil ?? mctb.pauseUntil ?? null,
          manuallyPaused: schedule.manuallyPaused ?? mctb.manuallyPaused ?? null,
          platformRecoveryTemplateId:
            (mctb.platformRecoveryTemplateId as string | undefined) ??
            (runtime as { platformRecoveryTemplateId?: string })?.platformRecoveryTemplateId ??
            null,
        },
        effective: {
          loadMctbConsentMode: consentMode,
          runtimeEnabled: runtime?.enabled ?? null,
          runtimePhoneNumberId: runtime?.phoneNumberId ?? null,
          recoveryPaused,
          pauseKind,
          automationActive,
          texmlHandlerMode,
          phoneTexmlHandlerMode,
          messageTemplatePreview: runtime?.messageTemplate?.slice(0, 80) ?? null,
        },
        exclusions: {
          count: exclusionCount,
          certTestPresent: Boolean(certExclusion),
          certTestId: certExclusion?.id ?? null,
        },
        handoff: {
          recipientCount: handoffRecipients.length,
          emergencyDetectionEnabled: Boolean(handoffRow?.emergencyDetectionEnabled),
          certRecipientPresent: handoffRecipients.some(
            (r) => r.email === "mctb-browser-cert@transovo.test",
          ),
          certRecipientEditedPresent: handoffRecipients.some(
            (r) => r.email === "mctb-browser-cert-edited@transovo.test",
          ),
          emails: handoffRecipients.map((r) => r.email),
        },
        runtime: {
          sendAfterNoAnswer: runtime?.sendAfterNoAnswer ?? null,
          sendAfterBusy: runtime?.sendAfterBusy ?? null,
          sendAfterRejected: runtime?.sendAfterRejected ?? null,
          sendAfterTimeout: runtime?.sendAfterTimeout ?? null,
          sendAfterVoicemail: runtime?.sendAfterVoicemail ?? null,
          delaySeconds: runtime?.delaySeconds ?? null,
          messageTemplate: runtime?.messageTemplate ?? null,
          cooldownMinutes: runtime?.cooldownMinutes ?? null,
          maxMessagesPerCaller: runtime?.maxMessagesPerCaller ?? null,
          senderMode: runtime?.senderMode ?? null,
          platformRecoveryTemplateId:
            (runtime as { platformRecoveryTemplateId?: string })?.platformRecoveryTemplateId ??
            null,
        },
        onboarding: {
          forwardingCarrier: onboardingState.forwardingCarrier ?? null,
          forwardingRingSeconds: onboardingState.forwardingRingSeconds ?? null,
          businessNumberE164: onboardingState.businessNumberE164 ?? null,
        },
        voicemail: {
          boxId: voicemailBoxId,
          greetingText: voicemailGreetingText,
        },
        leadRecovery: {
          enabled: leadRecovery.enabled,
          callbackTimeFieldEnabled: aiFieldToggles.CALLBACK_TIME,
          collectCapabilities: leadRecovery.collectCapabilities ?? [],
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const p = getPrisma();
    if (p && typeof (p as { $disconnect?: () => Promise<void> }).$disconnect === "function") {
      await (p as { $disconnect: () => Promise<void> }).$disconnect();
    }
  });
