import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { saveBusinessBrainPartial, loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import { loadMctbHandoffConfig, saveMctbHandoffConfig } from "@/lib/mctb/handoff/config";
import { loadMctbLeadRecoveryKnowledgeBundle } from "@/lib/mctb/lead-recovery/knowledge-prompt";

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

    if (body.aboutBusiness !== undefined) {
      const raw = typeof body.aboutBusiness === "string" ? body.aboutBusiness : "";
      const aboutBusiness = raw.trim().slice(0, MAX_ABOUT) || null;
      await saveBusinessBrainPartial(auth.workspaceId, { aboutBusiness });
    }

    const handoffPatch: Parameters<typeof saveMctbHandoffConfig>[1] = {};
    if (body.emergencyCriteria !== undefined) {
      const raw =
        typeof body.emergencyCriteria === "string" ? body.emergencyCriteria : "";
      handoffPatch.emergencyCriteria = raw.trim().slice(0, MAX_EMERGENCY) || null;
    }
    if (body.emergencyDetectionEnabled === true || body.emergencyDetectionEnabled === false) {
      handoffPatch.emergencyDetectionEnabled = body.emergencyDetectionEnabled;
    }
    if (Object.keys(handoffPatch).length) {
      await saveMctbHandoffConfig(auth.workspaceId, handoffPatch);
    }

    const bundle = await loadMctbLeadRecoveryKnowledgeBundle(auth.workspaceId);
    return NextResponse.json({
      data: {
        aboutBusiness: bundle.about_business ?? "",
        emergencyCriteria: bundle.emergency_criteria ?? "",
        emergencyDetectionEnabled: bundle.emergency_detection_enabled,
        runtimePromptBlock: bundle.runtime_prompt_block,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
