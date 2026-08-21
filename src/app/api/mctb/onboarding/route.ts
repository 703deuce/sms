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
  provisionTrialTollFreeNumber,
} from "@/lib/mctb/onboarding/trial-number";
import {
  getTfvStatusForWorkspace,
  syncTrialTollFreeVerification,
} from "@/lib/mctb/tfv/service";
import { MCTB_CARRIER_GUIDES } from "@/lib/mctb/onboarding/carriers";
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

    const [state, demo, trialNumber, liveTest, trialInfo, trialReqs, tfv] = await Promise.all([
      loadMctbOnboardingState(auth.workspaceId),
      getDemoStatus(auth.workspaceId),
      getTrialNumberStatus(auth.workspaceId),
      getLiveTestStatus(auth.workspaceId),
      getTrialInfo(auth.workspaceId),
      getTrialActivationRequirements(auth.workspaceId),
      getTfvStatusForWorkspace(auth.workspaceId),
    ]);

    return NextResponse.json({
      state,
      steps: MCTB_ONBOARDING_STEP_ORDER,
      stepLabels: MCTB_ONBOARDING_STEP_LABELS,
      demo: {
        ...demo,
        label: MCTB_PLATFORM_DEMO_LABEL,
        description:
          "Transovo's pre-approved demo line — separate from your assigned trial toll-free number.",
      },
      trialNumber,
      liveTest,
      trial: trialInfo,
      trialRequirements: trialReqs,
      tfv: {
        status: tfv.status,
        approved: tfv.approved,
        record: tfv.record,
        trialE164: tfv.trialE164,
        submittedAt: state.tfvSubmittedAt,
        approvedAt: state.tfvApprovedAt,
        rejectedAt: state.tfvRejectedAt,
      },
      carriers: MCTB_CARRIER_GUIDES,
      platformDemoDisplay: MCTB_PLATFORM_DEMO_DISPLAY,
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
      forwardingCarrier?: MctbForwardingCarrier;
      businessNumberE164?: string;
      forwardingConnected?: boolean;
    };

    const prisma = getPrisma();
    let state = await loadMctbOnboardingState(auth.workspaceId);

    if (body.action === "provision_trial_number") {
      const result = await provisionTrialTollFreeNumber(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
      return NextResponse.json({ ok: true, state, trialNumber: result.trialNumber });
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

      const provision = await provisionTrialTollFreeNumber(auth.workspaceId);
      if (!provision.ok) {
        return NextResponse.json(
          { error: provision.error || "Could not assign trial number", state },
          { status: 400 },
        );
      }
      state = await loadMctbOnboardingState(auth.workspaceId);
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
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "MCTB_MESSAGE_CONFIGURED");
    }

    if (body.consentMode) {
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
    }

    if (body.forwardingCarrier || body.businessNumberE164) {
      const isStarting = Boolean(body.businessNumberE164 && !state.forwardingConnectedAt);
      state = await saveMctbOnboardingState(auth.workspaceId, {
        forwardingCarrier: body.forwardingCarrier || state.forwardingCarrier,
        businessNumberE164: body.businessNumberE164 || state.businessNumberE164,
        ...(body.forwardingConnected
          ? { forwardingConnectedAt: new Date().toISOString() }
          : {}),
      });
      if (isStarting) {
        await recordFunnelEvent(auth.workspaceId, "MCTB_FORWARDING_STARTED");
      }
      if (body.forwardingConnected) {
        state = markStepComplete(state, "connect");
        await recordFunnelEvent(auth.workspaceId, "MCTB_FORWARDING_VERIFIED");
        await saveMctbOnboardingState(auth.workspaceId, { currentStep: "live_test" });
        const { startLiveTestSession } = await import("@/lib/mctb/onboarding/live-test");
        await startLiveTestSession(auth.workspaceId);
      }
      await saveMctbOnboardingState(auth.workspaceId, state);
    }

    if (body.step === "tfv") {
      await recordFunnelEvent(auth.workspaceId, "MCTB_TFV_STARTED");
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: "tfv" });
    } else if (body.step) {
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: body.step });
    }

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      state: state.version ? state : defaultMctbOnboardingState(),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
