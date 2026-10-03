import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import { getLiveTestStatus, startLiveTestSession } from "@/lib/mctb/onboarding/live-test";
import {
  defaultMctbOnboardingState,
  isOnboardingComplete,
  loadMctbOnboardingState,
  markStepComplete,
  recordFunnelEvent,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import {
  activateMctbTrial,
  getTrialActivationRequirements,
  getTrialInfo,
} from "@/lib/mctb/onboarding/trial";
import {
  getTrialNumberStatus,
  provisionTrialMctbNumber,
  provisionTrialTollFreeNumber,
} from "@/lib/mctb/onboarding/trial-number";
import { provisionMctbCustomerTelnyxLocalNumber } from "@/lib/mctb/provisioning/provision-customer-local";
import { getOnboardingForwardTargetE164ForWorkspace } from "@/lib/mctb/onboarding/forward-target";
import { getMctbDefaultBusinessLineE164 } from "@/lib/mctb/onboarding/phone-numbers";
import {
  getTfvStatusForWorkspace,
  syncTrialTollFreeVerification,
} from "@/lib/mctb/tfv/service";
import { MCTB_CARRIER_GUIDES } from "@/lib/mctb/onboarding/carriers";
import {
  getForwardingVerificationStatus,
  startForwardingVerificationTest,
} from "@/lib/mctb/onboarding/forwarding-verification";
import {
  MCTB_ONBOARDING_STEP_LABELS,
  MCTB_ONBOARDING_STEP_ORDER,
  type MctbConsentMode,
  type MctbForwardingCarrier,
  type MctbOnboardingStep,
} from "@/lib/mctb/onboarding/types";
import {
  MCTB_WIZARD_PRIMARY_STEPS,
  MCTB_WIZARD_PRIMARY_LABELS,
  inferResumeStep,
  normalizeOnboardingStep,
  onboardingStepRequiresSavedConsent,
  wizardStageIndex,
} from "@/lib/mctb/onboarding/wizard-flow";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { startMctbTryItSession } from "@/lib/mctb/try-it/start-session";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { resolveMctbFirstRunWizardPolicy } from "@/lib/mctb/onboarding/first-run-policy";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";

export async function GET(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const setupGuideRequested =
      new URL(req.url).searchParams.get("mctbSetupGuide") === "1";
    traceMctbDebug("onboarding", "get_start", { workspaceId: auth.workspaceId });

    const { getWorkspaceIngressStatus } = await import(
      "@/lib/mctb/provisioning/get-workspace-ingress-status"
    );

    let state = await loadMctbOnboardingState(auth.workspaceId);
    const resumeStep = inferResumeStep(state);
    const currentCanonical = normalizeOnboardingStep(state.currentStep);
    if (
      resumeStep !== currentCanonical &&
      resumeStep !== "ready" &&
      resumeStep !== "complete" &&
      wizardStageIndex(resumeStep) < wizardStageIndex(currentCanonical)
    ) {
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: resumeStep });
    }

    const [demo, trialNumber, liveTest, trialInfo, trialReqs, tfv, forwardingVerification, forwardTargetE164, capabilities, workspaceIngress] =
      await Promise.all([
      getDemoStatus(auth.workspaceId),
      getTrialNumberStatus(auth.workspaceId),
      getLiveTestStatus(auth.workspaceId),
      getTrialInfo(auth.workspaceId),
      getTrialActivationRequirements(auth.workspaceId),
      getTfvStatusForWorkspace(auth.workspaceId),
      getForwardingVerificationStatus(auth.workspaceId).catch(() => null),
      getOnboardingForwardTargetE164ForWorkspace(auth.workspaceId),
      resolveMctbCapabilities(auth.workspaceId),
      getWorkspaceIngressStatus(auth.workspaceId),
    ]);

    const forwardingVerified = Boolean(
      state.forwardingConnectedAt || forwardingVerification?.verified,
    );
    const firstRun = resolveMctbFirstRunWizardPolicy({
      onboardingState: state,
      setupGuideRequested,
      forwardingVerified,
    });
    const senderPresentation = describeMctbSenderPresentation(
      capabilities.platformSenderActive ? "PLATFORM" : "WORKSPACE",
    );

    const prisma = getPrisma();
    const wsCfg = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { customFieldsConfig: true },
    });
    const mctbCfg =
      wsCfg?.customFieldsConfig &&
      typeof wsCfg.customFieldsConfig === "object" &&
      (wsCfg.customFieldsConfig as Record<string, unknown>).mctb &&
      typeof (wsCfg.customFieldsConfig as Record<string, unknown>).mctb === "object"
        ? ((wsCfg.customFieldsConfig as Record<string, unknown>).mctb as Record<string, unknown>)
        : {};
    const existingConsentAttestationRecorded =
      mctbCfg.existingConsentAttestation &&
      typeof mctbCfg.existingConsentAttestation === "object" &&
      (mctbCfg.existingConsentAttestation as Record<string, unknown>).accepted === true;

    traceMctbDebug("onboarding", "get_complete", {
      workspaceId: auth.workspaceId,
      currentStep: state.currentStep,
      consentMode: state.consentMode,
      completedSteps: state.completedSteps,
    });

    return NextResponse.json({
      state,
      existingConsentAttestationRecorded,
      steps: MCTB_ONBOARDING_STEP_ORDER,
      stepLabels: MCTB_ONBOARDING_STEP_LABELS,
      wizardPrimarySteps: MCTB_WIZARD_PRIMARY_STEPS,
      wizardPrimaryLabels: MCTB_WIZARD_PRIMARY_LABELS,
      demo: {
        ...demo,
        description:
          "Call your workspace MCTB number directly from your verified mobile — no forwarding required for this test.",
        consentMode: state.consentMode || "press_1",
        requiresForwarding: false,
      },
      trialNumber,
      liveTest,
      trial: trialInfo,
      trialRequirements: trialReqs,
      tfv: {
        status: tfv.status,
        approved: tfv.approved || trialNumber.messagingApproved === true,
        record: tfv.record,
        trialE164: tfv.trialE164,
        failureReason: tfv.record?.failureReason || null,
        submittedAt: state.tfvSubmittedAt,
        approvedAt: state.tfvApprovedAt,
        rejectedAt: state.tfvRejectedAt,
        messagingApproved: trialNumber.messagingApproved === true,
        numberClass: trialNumber.numberClass || null,
        complianceType: trialNumber.complianceType || null,
      },
      carriers: MCTB_CARRIER_GUIDES,
      forwardingVerification,
      demoIngressE164: demo.demoNumberE164 || null,
      forwardTargetE164: workspaceIngress.forwardTargetE164 ?? forwardTargetE164,
      productionForwardE164: workspaceIngress.forwardTargetE164 ?? forwardTargetE164,
      workspaceIngress,
      defaultBusinessLineE164: getMctbDefaultBusinessLineE164(),
      capabilities,
      senderPresentation,
      firstRun,
      onboardingComplete: isOnboardingComplete(state),
    });
  } catch (err) {
    traceMctbDebugError("onboarding", "get_failed", err);
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await req.json()) as {
      action?: string;
      step?: MctbOnboardingStep;
      businessName?: string;
      websiteUrl?: string;
      industry?: string;
      messageTemplate?: string;
      recoveryGoal?: string;
      consentMode?: MctbConsentMode;
      existingConsentAttested?: boolean;
      forwardingCarrier?: MctbForwardingCarrier;
      businessNumberE164?: string;
      forwardingRingSeconds?: number;
      /** @deprecated Use start_forwarding_test + Twilio verification */
      forwardingConnected?: boolean;
    };

    traceMctbDebug("onboarding", "post_start", {
      workspaceId: auth.workspaceId,
      action: body.action ?? null,
      step: body.step ?? null,
      consentMode: body.consentMode ?? null,
      businessNumberE164: body.businessNumberE164 ?? null,
    });

    const prisma = getPrisma();
    let state = await loadMctbOnboardingState(auth.workspaceId);

    const consentNotChosen = () =>
      !state.completedSteps.includes("consent") && !body.consentMode;

    if (body.action === "start_demo") {
      const user = await prisma.user.findUnique({
        where: { id: auth.session.userId },
        select: { phone: true, email: true },
      });
      if (!user?.phone) {
        return NextResponse.json(
          { error: "Verify your mobile number before starting the demo." },
          { status: 400 },
        );
      }
      const result = await startMctbTryItSession({
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        callerE164: user.phone,
        userEmail: user.email,
        consentMode: body.consentMode,
        existingConsentAttested: body.existingConsentAttested,
        context: "onboarding",
      });
      state = await loadMctbOnboardingState(auth.workspaceId);
      return NextResponse.json({
        ok: true,
        state,
        data: {
          demoNumberE164: result.demoNumberE164,
          session: result.session,
        },
      });
    }

    if (
      body.action === "provision_trial_number" ||
      body.action === "provision_workspace_ingress"
    ) {
      const { ensureMctbWorkspaceIngressReady } = await import(
        "@/lib/mctb/provisioning/ensure-workspace-ingress"
      );
      const result = await ensureMctbWorkspaceIngressReady(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      const trialNumber = state.workspaceTollFreeNumber || state.trialNumber;
      return NextResponse.json({ ok: true, state, trialNumber });
    }

    if (body.action === "provision_telnyx_local") {
      const result = await provisionMctbCustomerTelnyxLocalNumber(auth.workspaceId, {
        messageTemplate: body.messageTemplate || state.messageTemplate || undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      return NextResponse.json({
        ok: true,
        state,
        trialNumber: result.trialNumber,
        provisionActions: result.provisionActions,
      });
    }

    if (body.action === "activate_trial") {
      const result = await activateMctbTrial(auth.workspaceId);
      if (!result.ok) {
        await saveMctbOnboardingState(auth.workspaceId, {
          trialActivationLastError: result.reason || "activation_failed",
          trialActivationPendingAt: new Date().toISOString(),
        });
        return NextResponse.json({ error: result.reason || "Trial not ready" }, { status: 400 });
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      return NextResponse.json({ ok: true, state, trialEndsAt: result.trialEndsAt });
    }

    if (body.businessName) {
      await prisma.workspace.update({
        where: { id: auth.workspaceId },
        data: { name: body.businessName.trim(), displayName: body.businessName.trim() },
      });
      state = await saveMctbOnboardingState(auth.workspaceId, {
        businessName: body.businessName.trim(),
        websiteUrl: body.websiteUrl || state.websiteUrl,
        industry: body.industry || state.industry,
      });
      const { ensureMctbPlatformSenderDefault: ensurePlatformSender } = await import(
        "@/lib/mctb/ensure-platform-sender-default"
      );
      await ensurePlatformSender(auth.workspaceId).catch(() => undefined);

      if (body.businessNumberE164) {
        const { persistMctbWorkspaceBusinessLineE164 } = await import(
          "@/lib/mctb/tenant-production-binding"
        );
        await persistMctbWorkspaceBusinessLineE164(auth.workspaceId, body.businessNumberE164);
        state = await loadMctbOnboardingState(auth.workspaceId);
        state = await saveMctbOnboardingState(auth.workspaceId, {
          forwardingCarrier: body.forwardingCarrier || state.forwardingCarrier,
        });
      }
      state = markStepComplete(state, "business_line");
      await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        currentStep: "consent",
      });
      await recordFunnelEvent(auth.workspaceId, "MCTB_BUSINESS_INFO_COMPLETED");
    }

    if (body.recoveryGoal) {
      const { applyMctbRecoveryGoalConfiguration } = await import(
        "@/lib/mctb/apply-recovery-goal-config"
      );
      const { parseRecoveryGoalId } = await import("@/lib/mctb/recovery-goals");
      const goalId = parseRecoveryGoalId(body.recoveryGoal);
      if (goalId) {
        await applyMctbRecoveryGoalConfiguration({
          workspaceId: auth.workspaceId,
          goalId,
          actorUserId: auth.session.userId,
          messageOverride: body.messageTemplate ?? null,
        });
      }
    }

    if (body.messageTemplate) {
      if (consentNotChosen()) {
        return NextResponse.json(
          { error: "Choose a consent method before configuring text back." },
          { status: 400 },
        );
      }
      if (!body.recoveryGoal) {
        await updateMissedCallTextConfig({
          workspaceId: auth.workspaceId,
          patch: { initial_message: body.messageTemplate },
          actor: auth.session.userId,
          source: "mctb_onboarding",
        });
      }
      state = await saveMctbOnboardingState(auth.workspaceId, {
        messageTemplate: body.messageTemplate,
      });
      state = markStepComplete(state, "recovery");
      await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        currentStep: "voicemail",
      });
      await recordFunnelEvent(auth.workspaceId, "MCTB_MESSAGE_CONFIGURED");
    }

    if (body.action === "complete_notifications") {
      if (consentNotChosen()) {
        return NextResponse.json(
          { error: "Choose a consent method before continuing setup." },
          { status: 400 },
        );
      }
      state = markStepComplete(state, "notifications");
      state = await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        currentStep: "connect_calls",
      });
    }

    if (body.action === "complete_connect_phone") {
      if (consentNotChosen()) {
        return NextResponse.json(
          { error: "Choose a consent method before connecting your phone." },
          { status: 400 },
        );
      }
      const lineToPersist = body.businessNumberE164?.trim() || state.businessNumberE164?.trim();
      if (lineToPersist) {
        const { persistMctbWorkspaceBusinessLineE164 } = await import(
          "@/lib/mctb/tenant-production-binding"
        );
        await persistMctbWorkspaceBusinessLineE164(auth.workspaceId, lineToPersist);
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      try {
        await startForwardingVerificationTest(auth.workspaceId);
      } catch (err) {
        traceMctbDebug("onboarding", "forwarding_test_start_skipped", {
          workspaceId: auth.workspaceId,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
      state = markStepComplete(state, "connect_calls");
      await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        currentStep: "review_test",
      });
      await startLiveTestSession(auth.workspaceId).catch(() => undefined);
      state = await loadMctbOnboardingState(auth.workspaceId);
    }

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
      if (body.consentMode === "existing_consent") {
        const { isExistingConsentModeEligible } = await import(
          "@/lib/mctb/setup-consent-eligibility"
        );
        const { isMctbSetupMessagingReady } = await import("@/lib/mctb/setup-messaging-ready");
        const { loadMctbSetupPhoneOptionsWithTelnyxSync } = await import(
          "@/lib/mctb/setup-telnyx-messaging-sync"
        );
        const { loadComplianceOverview, loadPhoneNumbers } = await import("@/lib/workspace-data");
        const { deriveRequiredActions } = await import("@/lib/compliance-helpers");
        const { loadAdminMctbTestFlags } = await import("@/lib/mctb/admin-test-workspace");
        const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
        const [phones, compliance, reg, adminFlags, caps] = await Promise.all([
          loadMctbSetupPhoneOptionsWithTelnyxSync(auth.workspaceId),
          loadComplianceOverview(auth.workspaceId),
          loadPhoneNumbers(auth.workspaceId, { includeLinked: true }),
          loadAdminMctbTestFlags(auth.workspaceId),
          resolveMctbCapabilities(auth.workspaceId),
        ]);
        const messagingReady = isMctbSetupMessagingReady({
          phoneNumbers: phones,
          requiredActions: deriveRequiredActions(compliance.registration, reg),
          adminFlags,
        });
        if (
          !isExistingConsentModeEligible({
            messagingReady,
            platformSenderActive: caps.platformSenderActive,
            mctbProductActive: caps.pressOneConsent,
          })
        ) {
          return NextResponse.json(
            { error: "Use existing permission is not available for this workspace." },
            { status: 400 },
          );
        }
      }
      await saveMissedCallTextBack(auth.workspaceId, { activate: false });
      const ws = await prisma.workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { customFieldsConfig: true },
      });
      const cfg =
        ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
          ? (ws.customFieldsConfig as Record<string, unknown>)
          : {};
      const mctb =
        cfg.mctb && typeof cfg.mctb === "object"
          ? (cfg.mctb as Record<string, unknown>)
          : {};
      await prisma.workspace.update({
        where: { id: auth.workspaceId },
        data: {
          customFieldsConfig: {
            ...cfg,
            mctb: { ...mctb, consentMode: body.consentMode },
          },
        },
      });
      state = await saveMctbOnboardingState(auth.workspaceId, {
        consentMode: body.consentMode,
      });
      state = markStepComplete(state, "consent");
      await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        currentStep: "recovery",
      });
      await recordFunnelEvent(auth.workspaceId, "MCTB_CONSENT_SELECTED", {
        consentMode: body.consentMode,
      });
      const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
      await syncMctbConsentRouting(auth.workspaceId, auth.session.userId).catch(() => undefined);
      const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
        "@/lib/mctb/texml-ingress/texml-mode-provision"
      );
      await provisionMctbPhoneTexmlIngressModeForWorkspace(auth.workspaceId).catch(
        (err) => {
          traceMctbDebug("onboarding", "texml_mode_after_consent_failed", {
            workspaceId: auth.workspaceId,
            reason: err instanceof Error ? err.message : String(err),
          });
        },
      );
      if (body.consentMode === "existing_consent") {
        const { recordWorkspaceExistingConsentAttestation } = await import(
          "@/lib/mctb/capture/attestation"
        );
        await recordWorkspaceExistingConsentAttestation({
          workspaceId: auth.workspaceId,
          attestedByUserId: auth.session.userId,
        }).catch(() => undefined);
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
    }

    if (body.action === "mark_voicemail_configured") {
      if (consentNotChosen()) {
        return NextResponse.json(
          { error: "Choose a consent method before continuing setup." },
          { status: 400 },
        );
      }
      const { syncCanonicalMctbWorkspaceIngress } = await import(
        "@/lib/mctb/provisioning/sync-canonical-workspace-ingress"
      );
      const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
      const ingress = await syncCanonicalMctbWorkspaceIngress(auth.workspaceId).catch(() => ({
        ok: false as const,
        synced: false,
      }));
      if (ingress.phoneNumberId) {
        await ensureNumberVoicemailBox(
          auth.workspaceId,
          ingress.phoneNumberId,
          auth.session.userId,
        ).catch(() => undefined);
      }
      state = markStepComplete(state, "voicemail");
      state = await saveMctbOnboardingState(auth.workspaceId, {
        ...state,
        voicemailConfiguredAt: new Date().toISOString(),
        currentStep: "notifications",
      });
    }

    if (body.action === "start_forwarding_test") {
      const { isProductionActivationPhase } = await import("@/lib/mctb/ingress");
      if (!state.completedSteps.includes("consent")) {
        return NextResponse.json(
          { error: "Choose a consent method before verifying forwarding." },
          { status: 400 },
        );
      }
      const stepCanon = normalizeOnboardingStep(state.currentStep);
      if (!isProductionActivationPhase(state) && stepCanon !== "connect_calls") {
        return NextResponse.json(
          { error: "Forwarding setup is only available during production activation." },
          { status: 400 },
        );
      }
      await startForwardingVerificationTest(auth.workspaceId);
      state = await loadMctbOnboardingState(auth.workspaceId);
    }

    if (
      (body.forwardingCarrier || body.businessNumberE164 || body.forwardingRingSeconds != null) &&
      (state.completedSteps.includes("consent") || state.completedSteps.includes("business_line"))
    ) {
      const isStarting = Boolean(body.businessNumberE164 && !state.forwardingTestStartedAt);
      state = await saveMctbOnboardingState(auth.workspaceId, {
        forwardingCarrier: body.forwardingCarrier || state.forwardingCarrier,
        businessNumberE164: body.businessNumberE164 || state.businessNumberE164,
        ...(body.forwardingRingSeconds != null
          ? { forwardingRingSeconds: Math.min(30, Math.max(10, body.forwardingRingSeconds)) }
          : {}),
      });
      if (isStarting) {
        await recordFunnelEvent(auth.workspaceId, "MCTB_FORWARDING_STARTED");
      }
      await saveMctbOnboardingState(auth.workspaceId, state);
    }

    const forwardingCheck = await getForwardingVerificationStatus(auth.workspaceId).catch(
      () => null,
    );
    if (forwardingCheck?.verified) {
      state = await loadMctbOnboardingState(auth.workspaceId);
      if (state.forwardingConnectedAt && !state.completedSteps.includes("connect_calls")) {
        state = markStepComplete(state, "connect_calls");
        await saveMctbOnboardingState(auth.workspaceId, { currentStep: "review_test" });
        state = await loadMctbOnboardingState(auth.workspaceId);
      }
    }

    // Legacy clients — ignore self-attested forwarding without Twilio proof.
    if (body.forwardingConnected && !forwardingCheck?.verified) {
      return NextResponse.json(
        {
          error:
            "Forwarding must be verified with a real test call that reaches your Transovo number. Use Test forwarding.",
          forwardingVerification: forwardingCheck,
        },
        { status: 400 },
      );
    }

    if (body.step) {
      const nextStep = normalizeOnboardingStep(body.step);
      if (
        onboardingStepRequiresSavedConsent(state, nextStep) &&
        !body.consentMode
      ) {
        return NextResponse.json(
          { error: "Choose a consent method before continuing setup." },
          { status: 400 },
        );
      }
      if (nextStep === "recovery" && body.action === "provision_trial_number") {
        state = markStepComplete(state, "recovery");
      }
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: nextStep });
      // Billing: move workspace off `onboarding` plan onto free MCTB (10/mo allowance) — not a time-limited trial.
      if (nextStep === "ready" || nextStep === "complete") {
        await activateMctbTrial(auth.workspaceId).catch(() => undefined);
      }
    }

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);

    const forwardingVerification = await getForwardingVerificationStatus(
      auth.workspaceId,
    ).catch(() => null);

    traceMctbDebug("onboarding", "post_complete", {
      workspaceId: auth.workspaceId,
      action: body.action ?? null,
      currentStep: state.currentStep,
      forwardingVerified: forwardingVerification?.verified ?? null,
    });

    return NextResponse.json({
      ok: true,
      state: state.version ? state : defaultMctbOnboardingState(),
      forwardingVerification,
    });
  } catch (err) {
    traceMctbDebugError("onboarding", "post_failed", err);
    return jsonError(err, 500);
  }
}
