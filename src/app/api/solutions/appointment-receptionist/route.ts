import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createVoiceAgent,
  publishVoiceAgent,
  updateVoiceAgentDraft,
} from "@/lib/voice/agent-service";
import { buildWizardAgentConfig } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import { runAppointmentReceptionistActivateHooks } from "@/lib/solutions/appointment-receptionist/activate-hooks";
import { hasBlockingActivationIssues } from "@/lib/solutions/appointment-receptionist/capability-checklist";
import type {
  AppointmentReceptionistWizardState,
  WizardPersistAction,
} from "@/lib/solutions/appointment-receptionist/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

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

    const activationMode = state.activationMode || "activate_now";
    const warnings: string[] = [];

    // Schedule without a datetime → treat as save_draft (do not publish).
    let effectiveAction: WizardPersistAction | "activate" = action;
    if (action === "activate" && activationMode === "schedule") {
      if (!state.scheduledAt?.trim()) {
        effectiveAction = "save_draft";
        warnings.push(
          "Schedule activation needs a date/time — saved as draft instead of publishing.",
        );
      }
    }
    // save_draft activation mode always persists without publishing
    if (action === "activate" && activationMode === "save_draft") {
      effectiveAction = "save_draft";
    }

    const name = (state.solutionName || "Appointment Receptionist").trim();
    const draftConfig = buildWizardAgentConfig(state);

    // Store schedule intent on advanced even when not publishing yet.
    if (activationMode === "schedule" && state.scheduledAt?.trim()) {
      const adv = (draftConfig.advanced || {}) as Record<string, unknown>;
      draftConfig.advanced = {
        ...adv,
        activationMode: "schedule",
        scheduledAt: state.scheduledAt,
        appointmentReceptionistWizard: {
          ...((adv.appointmentReceptionistWizard as object) || {}),
          activationMode: "schedule",
          scheduledAt: state.scheduledAt,
        },
      };
    }

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

    // Push wizard data into shared platform records (KB, services, transfer, insights).
    const hooks = await runAppointmentReceptionistActivateHooks({
      workspaceId: auth.workspaceId,
      agentId,
      state,
      mode: effectiveAction === "activate" ? "activate" : "save_draft",
    });

    const shouldPublish =
      effectiveAction === "activate" &&
      (activationMode === "activate_now" || activationMode === "duplicate_location");

    // Scheduled activation: persist DRAFT with schedule metadata, do not publish yet.
    const scheduleOnly =
      effectiveAction === "activate" &&
      activationMode === "schedule" &&
      Boolean(state.scheduledAt?.trim());

    if (shouldPublish && hasBlockingActivationIssues(hooks.issues)) {
      return NextResponse.json(
        {
          error: "Activation checklist incomplete",
          data: {
            agentId,
            issues: hooks.issues,
            published: false,
            warnings,
          },
        },
        { status: 400 },
      );
    }

    const configWithKb = {
      ...draftConfig,
      knowledgeBaseIds: hooks.knowledgeBaseId
        ? [hooks.knowledgeBaseId]
        : draftConfig.knowledgeBaseIds || [],
    };

    const updated = await updateVoiceAgentDraft(auth.workspaceId, agentId, {
      name,
      description: "Answer Calls and Book Appointments — wizard setup",
      agentType: "appointment_booking",
      displayName: state.agentName || name,
      purpose: "appointment_receptionist",
      phoneNumberId: shouldPublish ? state.phoneNumberId : state.phoneNumberId,
      draftConfig: configWithKb,
      status: shouldPublish ? undefined : "DRAFT",
    });

    // Long-term memory via VoiceMemoryConfig when opted in.
    if (state.longTermMemory && (shouldPublish || scheduleOnly || effectiveAction !== "create_draft")) {
      try {
        const { saveMemoryConfig } = await import("@/lib/voice/platform/ai-platform");
        await saveMemoryConfig(auth.workspaceId, agentId, {
          mode: "caller",
          retentionDays: 30,
        });
      } catch {
        warnings.push("Could not enable long-term memory — configure it later in AI platform.");
      }
    }

    let published = false;
    let publishError: string | null = null;
    let previousAiOwner: { id: string; name: string } | null = null;
    let clonedAgentId: string | null = null;

    if (shouldPublish) {
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

      // Duplicate for another location: clone agent with same config, leave as DRAFT
      // (no phone assigned) so the second office can be wired separately.
      if (activationMode === "duplicate_location" && published) {
        try {
          const copyName = `${name} (copy)`;
          const clone = await createVoiceAgent(auth.workspaceId, {
            name: copyName,
            agentType: "appointment_booking",
            templateId: "appointment_booking",
            description: "Cloned from Appointment Receptionist wizard",
          });
          const cloneConfig = parseVoiceAgentConfig(configWithKb);
          // Don't bind the copy to the same DID.
          await updateVoiceAgentDraft(auth.workspaceId, clone.id, {
            name: copyName,
            description: "Cloned from Appointment Receptionist wizard",
            agentType: "appointment_booking",
            displayName: `${state.agentName || name} (copy)`,
            purpose: "appointment_receptionist",
            phoneNumberId: null,
            draftConfig: cloneConfig,
            status: "DRAFT",
          });
          if (state.longTermMemory) {
            const { saveMemoryConfig } = await import("@/lib/voice/platform/ai-platform");
            await saveMemoryConfig(auth.workspaceId, clone.id, {
              mode: "caller",
              retentionDays: 30,
            }).catch(() => undefined);
          }
          clonedAgentId = clone.id;
        } catch (err) {
          warnings.push(
            err instanceof Error
              ? `Clone failed: ${err.message}`
              : "Clone for duplicate location failed",
          );
        }
      }
    } else if (scheduleOnly) {
      warnings.push(
        `Activation scheduled for ${state.scheduledAt} — agent kept as DRAFT until then.`,
      );
    }

    return NextResponse.json({
      data: {
        agentId,
        clonedAgentId,
        agentIds: clonedAgentId ? [agentId, clonedAgentId] : [agentId],
        name: updated.name,
        status: published ? "ACTIVE" : updated.status,
        published,
        publishError,
        previousAiOwner,
        issues: hooks.issues,
        warnings,
        activationMode,
        scheduledAt: state.scheduledAt || null,
        hooks: {
          knowledgeBaseId: hooks.knowledgeBaseId,
          calendarConnectionId: hooks.calendarConnectionId,
          serviceIds: hooks.serviceIds,
          insightGroupId: hooks.insightGroupId,
          transferSynced: hooks.transferSynced,
          transferE164: hooks.transferE164,
          routingSynced: hooks.routingSynced,
          routingMode: hooks.routingMode,
        },
        telnyxAssistantId: (updated as { telnyxAssistantId?: string | null })
          .telnyxAssistantId,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
