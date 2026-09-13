import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadLeadRecoveryConfig,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { simulateLeadRecoveryTurn } from "@/lib/mctb/lead-recovery/simulation";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";
import { intentsForEnabledScenarios } from "@/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const config = await loadLeadRecoveryConfig(auth.workspaceId);
    const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, config);
    if (url.searchParams.get("simulate") === "1") {
      const message = url.searchParams.get("message") || "";
      const simulation = await simulateLeadRecoveryTurn({
        workspaceId: auth.workspaceId,
        config,
        message,
      });
      return NextResponse.json({ data: { config, health, simulation } });
    }
    return NextResponse.json({ data: { config, health } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const enabledScenarios =
      body.enabledScenarios && typeof body.enabledScenarios === "object"
        ? (body.enabledScenarios as Partial<Record<LeadRecoveryScenarioKey, boolean>>)
        : undefined;
    const config = await saveLeadRecoveryConfig(auth.workspaceId, {
      enabled: body.enabled === true,
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
    });
    const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, config);
    return NextResponse.json({ data: { config, health } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
