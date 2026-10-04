import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  fieldTogglesFromBody,
  saveAiRecoveryBundle,
} from "@/lib/mctb/ai-recovery/save-bundle";
import { normalizeSmsCollectFields } from "@/lib/mctb/ai-recovery/collect-field-schema";
import { parseMctbAiRecoveryGoalType } from "@/lib/mctb/ai-recovery/recovery-goal";
import type { LeadRecoveryScenarioKey, MctbAiRecoveryGoalType } from "@/lib/mctb/lead-recovery/types";

/**
 * Canonical save for /mctb/ai-recovery — one request publishes settings + knowledge + runtime arming.
 * Consent, phone, forwarding, and other Setup pages are never modified here.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as Record<string, unknown>;
    const enabled = body.enabled === true;

    if (enabled) {
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

    const bookingLinkEnabled = body.bookingLinkEnabled === true;
    const bookingLinkId =
      typeof body.bookingLinkId === "string"
        ? body.bookingLinkId
        : body.bookingLinkId === null
          ? null
          : undefined;

    const recoveryGoalType = parseMctbAiRecoveryGoalType(body.recoveryGoalType) as
      | MctbAiRecoveryGoalType
      | undefined;
    const customRecoveryGoal =
      typeof body.customRecoveryGoal === "string" ? body.customRecoveryGoal : undefined;

    const result = await saveAiRecoveryBundle({
      workspaceId: auth.workspaceId,
      enabled,
      smsCollectFields: body.smsCollectFields
        ? normalizeSmsCollectFields(body.smsCollectFields)
        : undefined,
      allowDynamicCustomQuestions:
        body.allowDynamicCustomQuestions === undefined
          ? undefined
          : body.allowDynamicCustomQuestions !== false,
      enabledScenarios,
      bookingLinkEnabled,
      bookingLinkId,
      fieldToggles: body.fields != null ? fieldTogglesFromBody(body) : undefined,
      aboutBusiness:
        typeof body.aboutBusiness === "string" ? body.aboutBusiness : undefined,
      emergencyCriteria:
        typeof body.emergencyCriteria === "string" ? body.emergencyCriteria : undefined,
      recoveryGoalType,
      customRecoveryGoal,
    });

    return NextResponse.json({
      data: {
        config: result.config,
        health: result.health,
        consentMode: result.consentMode,
        runtimeArmed: result.runtimeArmed,
        runtimePromptBlock: result.runtimePromptBlock,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
