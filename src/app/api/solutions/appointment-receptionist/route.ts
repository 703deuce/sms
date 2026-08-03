import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createVoiceAgent,
  publishVoiceAgent,
  updateVoiceAgentDraft,
} from "@/lib/voice/agent-service";
import { buildWizardAgentConfig } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import type {
  AppointmentReceptionistWizardState,
  WizardPersistAction,
} from "@/lib/solutions/appointment-receptionist/types";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      action?: WizardPersistAction;
      state?: AppointmentReceptionistWizardState;
    };

    const action = body.action || "save_draft";
    const state = body.state;
    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "state is required" }, { status: 400 });
    }

    const name = (state.solutionName || "Appointment Receptionist").trim();
    const draftConfig = buildWizardAgentConfig(state);

    let agentId = state.agentId ?? "";
    if (!agentId) {
      const created = await createVoiceAgent(auth.workspaceId, {
        name,
        agentType: "appointment_booking",
        templateId: "appointment_booking",
        description: "Answer Calls and Book Appointments — wizard setup",
      });
      agentId = created.id;
    }

    const updated = await updateVoiceAgentDraft(auth.workspaceId, agentId, {
      name,
      description: "Answer Calls and Book Appointments — wizard setup",
      agentType: "appointment_booking",
      displayName: state.agentName || name,
      purpose: "appointment_receptionist",
      phoneNumberId: state.phoneNumberId,
      draftConfig,
      status: action === "activate" ? undefined : "DRAFT",
    });

    // Persist transfer destination so escalate_human has a real E.164 at runtime.
    let transferSynced: { synced: boolean; e164: string | null } = {
      synced: false,
      e164: null,
    };
    if (state.transferDestinationPhone?.trim()) {
      try {
        const { syncWizardTransferDestinations } = await import(
          "@/lib/solutions/appointment-receptionist/sync-transfer"
        );
        const result = await syncWizardTransferDestinations({
          workspaceId: auth.workspaceId,
          agentId,
          destinationName: state.transferDestinationName,
          destinationPhone: state.transferDestinationPhone,
          returnToAiOnFail: state.transferFallback === "return_to_ai",
        });
        transferSynced = { synced: result.synced, e164: result.e164 };
      } catch (err) {
        console.warn(
          "[appointment-receptionist] transfer destination sync failed",
          err instanceof Error ? err.message : err,
        );
      }
    }

    let published = false;
    let publishError: string | null = null;
    let previousAiOwner: { id: string; name: string } | null = null;
    if (action === "activate") {
      if (state.phoneNumberId) {
        try {
          const { getPhoneNumberAiOwner } = await import("@/lib/voice/agent-phone");
          const owner = await getPhoneNumberAiOwner(
            auth.workspaceId,
            state.phoneNumberId,
          );
          if (owner && owner.id !== agentId) {
            previousAiOwner = { id: owner.id, name: owner.name };
          }
        } catch {
          // non-blocking
        }
      }
      try {
        await publishVoiceAgent(auth.workspaceId, agentId, auth.session.userId);
        published = true;
      } catch (err) {
        // Try build-for-test then publish once — common when assistant not synced yet.
        try {
          const { buildVoiceAgentForTest } = await import("@/lib/voice/agent-service");
          await buildVoiceAgentForTest(auth.workspaceId, agentId, auth.session.userId);
          await publishVoiceAgent(auth.workspaceId, agentId, auth.session.userId);
          published = true;
        } catch (err2) {
          publishError =
            err2 instanceof Error
              ? err2.message
              : err instanceof Error
                ? err.message
                : "Publish failed";
        }
      }
    }

    return NextResponse.json({
      data: {
        agentId,
        name: updated.name,
        status: published ? "ACTIVE" : updated.status,
        published,
        publishError,
        previousAiOwner,
        transferSynced,
        telnyxAssistantId: (updated as { telnyxAssistantId?: string | null }).telnyxAssistantId,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
