import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import { getLiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import {
  defaultMctbOnboardingState,
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
import { getMctbDefaultBusinessLineE164, getMctbDemoIngressE164 } from "@/lib/mctb/onboarding/phone-numbers";
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
  MCTB_PLATFORM_DEMO_DISPLAY,
  MCTB_PLATFORM_DEMO_LABEL,
} from "@/lib/mctb/onboarding/constants";
import {
  MCTB_ONBOARDING_STEP_LABELS,
  MCTB_ONBOARDING_STEP_ORDER,
  type MctbConsentMode,
  type MctbForwardingCarrier,
  type MctbOnboardingStep,
} from "@/lib/mctb/onboarding/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);

    const [state, demo, trialNumber, liveTest, trialInfo, trialReqs, tfv, forwardingVerification, forwardTargetE164] =
      await Promise.all([
      loadMctbOnboardingState(auth.workspaceId),
      getDemoStatus(auth.workspaceId),
      getTrialNumberStatus(auth.workspaceId),
      getLiveTestStatus(auth.workspaceId),
      getTrialInfo(auth.workspaceId),
      getTrialActivationRequirements(auth.workspaceId),
      getTfvStatusForWorkspace(auth.workspaceId),
      getForwardingVerificationStatus(auth.workspaceId).catch(() => null),
      getOnboardingForwardTargetE164ForWorkspace(auth.workspaceId),
    ]);

    return NextResponse.json({
      state,
      steps: MCTB_ONBOARDING_STEP_ORDER,
      stepLabels: MCTB_ONBOARDING_STEP_LABELS,
      demo: {
        ...demo,
        label: MCTB_PLATFORM_DEMO_LABEL,
        description:
          "Call Transovo's demo line directly from your verified mobile — no forwarding or carrier setup. Experience Press 1 or Existing Consent exactly as configured above.",
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
      platformDemoDisplay: MCTB_PLATFORM_DEMO_DISPLAY,
      demoIngressE164: getMctbDemoIngressE164(),
      forwardTargetE164,
      productionForwardE164: forwardTargetE164,
      defaultBusinessLineE164: getMctbDefaultBusinessLineE164(),
    });
  } catch (err) {
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
      consentMode?: MctbConsentMode;
      existingConsentAttested?: boolean;
      forwardingCarrier?: MctbForwardingCarrier;
      businessNumberE164?: string;
      forwardingRingSeconds?: number;
      /** @deprecated Use start_forwarding_test + Twilio verification */
      forwardingConnected?: boolean;
    };

    const prisma = getPrisma();
    let state = await loadMctbOnboardingState(auth.workspaceId);

    if (body.action === "provision_trial_number") {
      const result = await provisionTrialMctbNumber(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      return NextResponse.json({ ok: true, state, trialNumber: result.trialNumber });
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
      state = markStepComplete(state, "business");
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "MCTB_BUSINESS_INFO_COMPLETED");
    }

    if (body.messageTemplate) {
      await updateMissedCallTextConfig({
        workspaceId: auth.workspaceId,
        patch: { initial_message: body.messageTemplate },
        actor: auth.session.userId,
        source: "mctb_onboarding",
      });
      state = await saveMctbOnboardingState(auth.workspaceId, {
        messageTemplate: body.messageTemplate,
      });
      state = markStepComplete(state, "configure");
      const trialStatus = await getTrialNumberStatus(auth.workspaceId);
      if (trialStatus.messagingApproved && trialStatus.numberClass === "TELNYX_LOCAL_A2P") {
        state = markStepComplete(state, "tfv");
        state = markStepComplete(state, "pending");
      }
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "MCTB_MESSAGE_CONFIGURED");
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
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "MCTB_CONSENT_SELECTED", {
        consentMode: body.consentMode,
      });
      const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
      await syncMctbConsentRouting(auth.workspaceId, auth.session.userId).catch(() => undefined);
      const { syncPlatformDemoConsentRuntime } = await import(
        "@/lib/mctb/onboarding/platform-demo"
      );
      await syncPlatformDemoConsentRuntime(body.consentMode).catch((err) => {
        console.error("[mctb/onboarding] syncPlatformDemoConsentRuntime", err);
      });
      if (body.consentMode === "existing_consent") {
        const { recordWorkspaceExistingConsentAttestation } = await import(
          "@/lib/mctb/event-only/attestation"
        );
        await recordWorkspaceExistingConsentAttestation({
          workspaceId: auth.workspaceId,
          attestedByUserId: auth.session.userId,
        }).catch(() => undefined);
      }
    }

    if (body.action === "start_forwarding_test") {
      const { isProductionActivationPhase } = await import("@/lib/mctb/ingress");
      if (!state.completedSteps.includes("demo")) {
        return NextResponse.json(
          { error: "Complete the direct-call demo before configuring forwarding." },
          { status: 400 },
        );
      }
      if (!isProductionActivationPhase(state) && state.currentStep !== "connect") {
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
      state.completedSteps.includes("demo")
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
      if (state.forwardingConnectedAt && !state.completedSteps.includes("connect")) {
        state = markStepComplete(state, "connect");
        await saveMctbOnboardingState(auth.workspaceId, { currentStep: "live_test" });
        const { startLiveTestSession } = await import("@/lib/mctb/onboarding/live-test");
        await startLiveTestSession(auth.workspaceId);
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

    if (body.step === "tfv") {
      await recordFunnelEvent(auth.workspaceId, "MCTB_TFV_STARTED");
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: "tfv" });
    } else if (body.step) {
      if (body.step === "trial_number" && !state.completedSteps.includes("demo")) {
        return NextResponse.json(
          { error: "Complete the direct-call demo before assigning your production number." },
          { status: 400 },
        );
      }
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: body.step });
    }

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);

    const forwardingVerification = await getForwardingVerificationStatus(
      auth.workspaceId,
    ).catch(() => null);

    return NextResponse.json({
      ok: true,
      state: state.version ? state : defaultMctbOnboardingState(),
      forwardingVerification,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
