import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadLeadRecoveryConfig,
  loadLeadRecoveryConfigPersisted,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { simulateLeadRecoveryTurn } from "@/lib/mctb/lead-recovery/simulation";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";
import { buildLeadRecoveryV1ConfigGetPayload } from "@/lib/mctb/lead-recovery/v1-config-api-payload";
import { intentsForEnabledScenarios } from "@/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { getStripeTextToPayCapabilities } from "@/lib/stripe-connect/capabilities";
import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const providerDiagnostics = url.searchParams.get("providerDiagnostics") === "1";

    if (providerDiagnostics) {
      const config = await loadLeadRecoveryConfig(auth.workspaceId);
      const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, config);
      const [aiBooking, aiReadiness, stripeCaps, brain] = await Promise.all([
        loadMctbAiBookingConfig(auth.workspaceId),
        evaluateMctbAiBookingReadiness(auth.workspaceId),
        getStripeTextToPayCapabilities(auth.workspaceId),
        loadBusinessBrain(auth.workspaceId),
      ]);
      const approvedKnowledge = brain.knowledgeFacts.filter(
        (f) => (f.status || "approved") === "approved",
      ).length;
      const providers = {
        booking: {
          provider: aiBooking.provider,
          connected: aiReadiness.providerConnected,
          ready: aiReadiness.ready,
          reason: aiReadiness.reason,
          calendarLabel: aiBooking.calendarId || aiBooking.serviceName || null,
          eventTypeLabel: aiBooking.eventTypeUri || aiBooking.eventTypeId || null,
        },
        stripe: {
          connected: stripeCaps.connected,
          canCharge: stripeCaps.canCreateCheckoutSession,
        },
      };
      const knowledge = {
        approvedCount: approvedKnowledge,
        ready: approvedKnowledge > 0,
      };
      if (url.searchParams.get("simulate") === "1") {
        const message = url.searchParams.get("message") || "";
        const simulation = await simulateLeadRecoveryTurn({
          workspaceId: auth.workspaceId,
          config,
          message,
        });
        return NextResponse.json({ data: { config, health, simulation, providers, knowledge } });
      }
      return NextResponse.json({ data: { config, health, providers, knowledge } });
    }

    const config = await loadLeadRecoveryConfigPersisted(auth.workspaceId);
    const payload = await buildLeadRecoveryV1ConfigGetPayload(auth.workspaceId, config);
    if (url.searchParams.get("simulate") === "1") {
      const message = url.searchParams.get("message") || "";
      const simulation = await simulateLeadRecoveryTurn({
        workspaceId: auth.workspaceId,
        config: payload.config,
        message,
      });
      return NextResponse.json({ data: { ...payload, simulation } });
    }
    return NextResponse.json({ data: payload });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;

    if (body.enabled === true) {
      const { assertMctbCapability } = await import("@/lib/mctb/capabilities");
      const gate = await assertMctbCapability(auth.workspaceId, "aiRecoveryEntitled");
      if (!gate.ok) {
        return NextResponse.json(
          { error: "AI Recovery requires an AI Recovery plan." },
          { status: 403 },
        );
      }
    }
    const enabledScenarios =
      body.enabledScenarios && typeof body.enabledScenarios === "object"
        ? (body.enabledScenarios as Partial<Record<LeadRecoveryScenarioKey, boolean>>)
        : undefined;
    const patch: Parameters<typeof saveLeadRecoveryConfig>[1] = {
      enabledScenarios,
      enabledIntents: enabledScenarios
        ? intentsForEnabledScenarios(enabledScenarios)
        : Array.isArray(body.enabledIntents)
          ? body.enabledIntents
          : undefined,
      globalMode:
        body.globalMode === "CAPTURE_ONLY" || body.globalMode === "INFORMATION_ONLY"
          ? body.globalMode
          : body.globalMode === "STANDARD"
            ? "STANDARD"
            : undefined,
      globalBehavior:
        body.globalBehavior && typeof body.globalBehavior === "object"
          ? (body.globalBehavior as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["globalBehavior"])
          : undefined,
      paymentPolicy:
        body.paymentPolicy && typeof body.paymentPolicy === "object"
          ? (body.paymentPolicy as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["paymentPolicy"])
          : undefined,
      serviceAreaPolicy:
        body.serviceAreaPolicy && typeof body.serviceAreaPolicy === "object"
          ? (body.serviceAreaPolicy as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["serviceAreaPolicy"])
          : undefined,
      existingCustomerPolicy:
        body.existingCustomerPolicy && typeof body.existingCustomerPolicy === "object"
          ? (body.existingCustomerPolicy as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["existingCustomerPolicy"])
          : undefined,
      faqPolicy:
        body.faqPolicy && typeof body.faqPolicy === "object"
          ? (body.faqPolicy as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["faqPolicy"])
          : undefined,
      intentPolicies:
        body.intentPolicies && typeof body.intentPolicies === "object"
          ? (body.intentPolicies as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["intentPolicies"])
          : undefined,
      fallbackPolicy:
        body.fallbackPolicy && typeof body.fallbackPolicy === "object"
          ? (body.fallbackPolicy as import("@/lib/mctb/lead-recovery/types").IntentPolicyShape)
          : undefined,
      collectCapabilities: Array.isArray(body.collectCapabilities) ? body.collectCapabilities : undefined,
      answerCapabilities: Array.isArray(body.answerCapabilities) ? body.answerCapabilities : undefined,
      actionCapabilities: Array.isArray(body.actionCapabilities) ? body.actionCapabilities : undefined,
      handoffTriggers:
        body.handoffTriggers && typeof body.handoffTriggers === "object"
          ? (body.handoffTriggers as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["handoffTriggers"])
          : undefined,
      bookingLinkId:
        typeof body.bookingLinkId === "string"
          ? body.bookingLinkId
          : body.bookingLinkId === null
            ? null
            : undefined,
      version: typeof body.version === "number" ? body.version : undefined,
    };
    if (typeof body.enabled === "boolean") {
      patch.enabled = body.enabled;
    }
    const config = await saveLeadRecoveryConfig(auth.workspaceId, patch);
    const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, config);
    return NextResponse.json({ data: { config, health } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
