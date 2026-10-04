import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  fieldTogglesFromBody,
  saveAiRecoveryBundle,
} from "@/lib/mctb/ai-recovery/save-bundle";
import { normalizeSmsCollectFields } from "@/lib/mctb/ai-recovery/collect-field-schema";
import type { LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";

/** @deprecated Prefer POST /api/mctb/ai-recovery/save — kept for legacy callers. */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as Record<string, unknown>;
    const enabled = body.enabled === true;
    const bookingLinkEnabled = body.bookingLinkEnabled === true;
    const bookingLinkId =
      typeof body.bookingLinkId === "string"
        ? body.bookingLinkId
        : body.bookingLinkId === null
          ? null
          : undefined;

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
      fieldToggles: fieldTogglesFromBody(body),
    });

    return NextResponse.json({
      data: { config: result.config, health: result.health, consentMode: result.consentMode },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
