import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import {
  deriveRequiredActions,
  phoneNumbersSummary,
  tollFreeSummary,
} from "@/lib/compliance-helpers";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import {
  defaultMctbOnboardingState,
  loadMctbOnboardingState,
  markStepComplete,
  recordFunnelEvent,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import {
  activateMctbTrial,
  getTrialActivationRequirements,
  getTrialInfo,
} from "@/lib/mctb/onboarding/trial";
import { MCTB_CARRIER_GUIDES } from "@/lib/mctb/onboarding/carriers";
import {
  MCTB_ONBOARDING_STEP_LABELS,
  MCTB_ONBOARDING_STEP_ORDER,
  type MctbConsentMode,
  type MctbForwardingCarrier,
  type MctbOnboardingStep,
} from "@/lib/mctb/onboarding/types";

function parseConsentMode(value: unknown): MctbConsentMode | undefined {
  return value === "press_1" || value === "existing_consent" ? value : undefined;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const [state, compliance, phoneNumbers, reg, trialInfo, demo, trialReqs] =
      await Promise.all([
        loadMctbOnboardingState(auth.workspaceId),
        loadComplianceOverview(auth.workspaceId),
        loadPhoneNumbers(auth.workspaceId),
        prisma.messagingRegistration.findUnique({
          where: { workspaceId: auth.workspaceId },
        }),
        getTrialInfo(auth.workspaceId),
        getDemoStatus(auth.workspaceId),
        getTrialActivationRequirements(auth.workspaceId),
      ]);

    const requiredActions = deriveRequiredActions(compliance.registration, phoneNumbers);
    const brandOk = ["APPROVED", "VERIFIED"].includes(
      String(reg?.brandStatus || "").toUpperCase(),
    );
    const campaignOk = ["APPROVED", "VERIFIED"].includes(
      String(reg?.campaignStatus || "").toUpperCase(),
    );
    const complianceApproved = brandOk && campaignOk && Boolean(reg?.registrationApprovedAt);

    return NextResponse.json({
      state,
      steps: MCTB_ONBOARDING_STEP_ORDER,
      stepLabels: MCTB_ONBOARDING_STEP_LABELS,
      demo,
      trial: trialInfo,
      trialRequirements: trialReqs,
      compliance: {
        requiredActions,
        brandStatus: reg?.brandStatus || "Not started",
        campaignStatus: reg?.campaignStatus || "Not started",
        approved: complianceApproved,
        phoneSummary: phoneNumbersSummary(phoneNumbers),
        tollFreeSummary: tollFreeSummary(phoneNumbers),
      },
      carriers: MCTB_CARRIER_GUIDES,
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
      industry?: string;
      messageTemplate?: string;
      consentMode?: MctbConsentMode;
      forwardingCarrier?: MctbForwardingCarrier;
      businessNumberE164?: string;
      forwardingConnected?: boolean;
      liveTestPassed?: boolean;
      complianceSubmitted?: boolean;
    };

    const prisma = getPrisma();
    let state = await loadMctbOnboardingState(auth.workspaceId);

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
        industry: body.industry || state.industry,
      });
      state = markStepComplete(state, "business");
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "business_info_completed");
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
      await recordFunnelEvent(auth.workspaceId, "configure_completed");
    }

    if (body.consentMode) {
      await saveMissedCallTextBack(auth.workspaceId, {
        activate: false,
      });
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
      await recordFunnelEvent(auth.workspaceId, "consent_selected", {
        consentMode: body.consentMode,
      });
    }

    if (body.complianceSubmitted) {
      state = await saveMctbOnboardingState(auth.workspaceId, {
        complianceSubmittedAt: new Date().toISOString(),
        currentStep: "pending",
      });
      state = markStepComplete(state, "compliance");
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "compliance_submitted");
    }

    if (body.forwardingCarrier || body.businessNumberE164) {
      state = await saveMctbOnboardingState(auth.workspaceId, {
        forwardingCarrier: body.forwardingCarrier || state.forwardingCarrier,
        businessNumberE164: body.businessNumberE164 || state.businessNumberE164,
        ...(body.forwardingConnected
          ? { forwardingConnectedAt: new Date().toISOString() }
          : {}),
      });
      if (body.forwardingConnected) {
        state = markStepComplete(state, "connect");
        await recordFunnelEvent(auth.workspaceId, "forwarding_connected");
      }
      await saveMctbOnboardingState(auth.workspaceId, state);
    }

    if (body.liveTestPassed) {
      state = await saveMctbOnboardingState(auth.workspaceId, {
        liveTestPassedAt: new Date().toISOString(),
      });
      state = markStepComplete(state, "live_test");
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "live_test_passed");

      const activation = await activateMctbTrial(auth.workspaceId);
      if (activation.ok) {
        state = await loadMctbOnboardingState(auth.workspaceId);
      }
    }

    if (body.step) {
      state = await saveMctbOnboardingState(auth.workspaceId, { currentStep: body.step });
    }

    // Sync compliance approval from registration
    const reg = await prisma.messagingRegistration.findUnique({
      where: { workspaceId: auth.workspaceId },
    });
    const brandOk = ["APPROVED", "VERIFIED"].includes(
      String(reg?.brandStatus || "").toUpperCase(),
    );
    const campaignOk = ["APPROVED", "VERIFIED"].includes(
      String(reg?.campaignStatus || "").toUpperCase(),
    );
    if (brandOk && campaignOk && reg?.registrationApprovedAt && !state.complianceApprovedAt) {
      state = await saveMctbOnboardingState(auth.workspaceId, {
        complianceApprovedAt: reg.registrationApprovedAt.toISOString(),
        currentStep: state.currentStep === "pending" ? "connect" : state.currentStep,
      });
      state = markStepComplete(state, "pending");
      await saveMctbOnboardingState(auth.workspaceId, state);
      await recordFunnelEvent(auth.workspaceId, "compliance_approved");
    }

    return NextResponse.json({
      ok: true,
      state: state.version ? state : defaultMctbOnboardingState(),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
