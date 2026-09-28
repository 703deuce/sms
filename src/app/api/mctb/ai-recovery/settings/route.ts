import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildAiRecoverySavePatch } from "@/lib/mctb/ai-recovery/sync-collection-config";
import {
  deriveSimplifiedFieldEnabled,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import {
  loadLeadRecoveryConfig,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";
import { applyLaunchAiRepliesSetting } from "@/lib/mctb/launch-lead-recovery";
import { saveMctbHandoffConfig } from "@/lib/mctb/handoff/config";

function parseFieldToggles(body: Record<string, unknown>): Record<AiRecoverySimplifiedField, boolean> {
  const fields = body.fields;
  const base = deriveSimplifiedFieldEnabled([]);
  if (!fields || typeof fields !== "object") return base;
  const f = fields as Record<string, unknown>;
  return {
    NAME: f.NAME === true,
    REASON: f.REASON === true,
    ADDRESS: f.ADDRESS === true,
    URGENCY: f.URGENCY === true,
    CALLBACK_TIME: f.CALLBACK_TIME === true,
  };
}

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

    const existing = await loadLeadRecoveryConfig(auth.workspaceId);

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

    if (!enabled) {
      await applyLaunchAiRepliesSetting(auth.workspaceId, false);
      const disabledConfig = await loadLeadRecoveryConfig(auth.workspaceId);
      const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, disabledConfig);
      return NextResponse.json({ data: { config: disabledConfig, health } });
    }

    const patch = buildAiRecoverySavePatch({
      enabled: true,
      fieldToggles: parseFieldToggles(body),
      bookingLinkEnabled,
      bookingLinkId: bookingLinkId ?? existing.bookingLinkId,
      existing,
    });

    await saveLeadRecoveryConfig(auth.workspaceId, patch);
    await saveMctbHandoffConfig(auth.workspaceId, {
      responseMode: "ai_conversation",
      bookingBehavior: "on_request",
    }).catch(() => undefined);

    const finalConfig = await loadLeadRecoveryConfig(auth.workspaceId);
    const health = await computeLeadRecoveryPolicyHealth(auth.workspaceId, finalConfig);
    return NextResponse.json({ data: { config: finalConfig, health } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
