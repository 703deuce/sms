import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { applySelectedCandidates } from "@/lib/voice-v3/business-import/apply";
import type { ReviewCandidate } from "@/lib/voice-v3/business-import/types";
import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { emitBusinessImportEvent } from "@/lib/voice-v3/business-import/events";
import { upsertAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ importId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { importId } = await ctx.params;
    const body = (await request.json()) as {
      selectedCandidateIds?: string[];
      treatSemanticDuplicateAsSame?: string[];
    };

    const prisma = getPrisma();
    const row = await prisma.voiceV3BusinessKnowledgeImport.findFirst({
      where: { id: importId, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status !== "REVIEW_READY" && row.status !== "PARTIAL") {
      return NextResponse.json({ error: "Import is not ready for review" }, { status: 400 });
    }

    const review = row.reviewJson as { candidates?: ReviewCandidate[] } | null;
    const candidates = review?.candidates || [];
    const selectedIds = new Set(body.selectedCandidateIds || []);
    const selected = candidates
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ ...c, userSelected: true as const }));

    const loaded = await loadAppointmentReceptionistSetup(auth.workspaceId, {
      agentId: row.voiceAgentId,
    });
    const base = {
      ...createDefaultWizardState(),
      ...(loaded.state || {}),
    } as AppointmentReceptionistWizardState;

    const nextState = applySelectedCandidates(base, selected);

    const agent = await prisma.voiceAgent.findFirst({
      where: { id: row.voiceAgentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const prevConfig = parseVoiceAgentConfig(agent.draftConfig);
    const advanced = {
      ...((prevConfig.advanced || {}) as Record<string, unknown>),
      appointmentReceptionistWizard: nextState,
    };
    const draftConfig = {
      ...prevConfig,
      advanced,
    };
    await updateVoiceAgentDraft(auth.workspaceId, row.voiceAgentId, {
      draftConfig,
    });

    await upsertAppointmentReceptionistSetup({
      workspaceId: auth.workspaceId,
      agentId: row.voiceAgentId,
      state: { ...nextState, agentId: row.voiceAgentId },
      published: false,
    }).catch(() => undefined);

    await prisma.voiceV3BusinessKnowledgeImport.update({
      where: { id: importId },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        appliedPatchJson: { selectedCandidateIds: [...selectedIds] },
      },
    });

    emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_APPLIED", auth.workspaceId, {
      importId,
      acceptedCount: selected.length,
    });

    return NextResponse.json({ data: { state: nextState } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
