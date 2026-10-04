import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import { loadMctbHandoffConfig } from "@/lib/mctb/handoff/config";
import { loadMctbLeadRecoveryKnowledgeBundle } from "@/lib/mctb/lead-recovery/knowledge-prompt";
import { saveAiRecoveryBundle } from "@/lib/mctb/ai-recovery/save-bundle";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";

const MAX_ABOUT = 12_000;
const MAX_EMERGENCY = 4_000;

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [brain, handoff, bundle] = await Promise.all([
      loadBusinessBrain(auth.workspaceId),
      loadMctbHandoffConfig(auth.workspaceId),
      loadMctbLeadRecoveryKnowledgeBundle(auth.workspaceId),
    ]);

    return NextResponse.json({
      data: {
        aboutBusiness: brain.aboutBusiness ?? "",
        emergencyCriteria: handoff.emergencyCriteria ?? "",
        emergencyDetectionEnabled: handoff.emergencyDetectionEnabled,
        runtimePromptPreview: bundle.runtime_prompt_block.slice(0, 500),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { assertMctbCapability } = await import("@/lib/mctb/capabilities");
    const gate = await assertMctbCapability(auth.workspaceId, "aiRecoveryEntitled");
    if (!gate.ok) {
      return NextResponse.json(
        { error: "AI Recovery requires an AI Recovery plan." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const existing = await loadLeadRecoveryConfig(auth.workspaceId);

    const aboutBusiness =
      body.aboutBusiness !== undefined
        ? typeof body.aboutBusiness === "string"
          ? body.aboutBusiness.trim().slice(0, MAX_ABOUT)
          : ""
        : undefined;
    const emergencyCriteria =
      body.emergencyCriteria !== undefined
        ? typeof body.emergencyCriteria === "string"
          ? body.emergencyCriteria.trim().slice(0, MAX_EMERGENCY)
          : ""
        : undefined;

    const emergenciesOn = body.emergencyDetectionEnabled === true;
    const result = await saveAiRecoveryBundle({
      workspaceId: auth.workspaceId,
      enabled: existing.enabled,
      aboutBusiness,
      emergencyCriteria,
      emergencyDetectionEnabled:
        body.emergencyDetectionEnabled === true || body.emergencyDetectionEnabled === false
          ? body.emergencyDetectionEnabled
          : emergenciesOn,
    });

    const [brain, handoff] = await Promise.all([
      loadBusinessBrain(auth.workspaceId),
      loadMctbHandoffConfig(auth.workspaceId),
    ]);

    return NextResponse.json({
      data: {
        aboutBusiness: brain.aboutBusiness ?? "",
        emergencyCriteria: handoff.emergencyCriteria ?? "",
        emergencyDetectionEnabled: handoff.emergencyDetectionEnabled,
        runtimePromptBlock: result.runtimePromptBlock,
        consentMode: result.consentMode,
        runtimeArmed: result.runtimeArmed,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
