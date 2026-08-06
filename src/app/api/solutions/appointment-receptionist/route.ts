import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  createVoiceAgent,
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
import {
  loadAppointmentReceptionistSetup,
  outcomeSlugFromWizard,
  upsertAppointmentReceptionistSetup,
} from "@/lib/solutions/appointment-receptionist/save-setup";
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";
import { uniqueAgentDisplayName } from "@/lib/solutions/appointment-receptionist/wizard-presets";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const setupId = url.searchParams.get("setupId") || undefined;
    const agentId = url.searchParams.get("agentId") || undefined;
    const data = await loadAppointmentReceptionistSetup(auth.workspaceId, {
      setupId,
      agentId,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

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

    const rawName =
      (state.solutionName || "Appointment Receptionist").trim() ||
      "Appointment Receptionist";
    // Stamp uniqueness only on first create so five answering agents differ.
    const name = state.agentId
      ? rawName
      : uniqueAgentDisplayName(rawName);
    if (!state.agentId && name !== state.solutionName) {
      state.solutionName = name;
    }
    const draftConfig = buildWizardAgentConfig(state);
    const outcomeSlug = outcomeSlugFromWizard(state);
    const productAgentType = agentTypeFromOutcomeSlug(outcomeSlug);

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
        agentType: productAgentType,
        templateId: "appointment_booking",
        description: `${productAgentType} — wizard setup`,
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

    // Company-scoped answers → Company Brain (canonical). Amy retrieves; does not own a second copy.
    try {
      const { syncCompanyBrainFromWizard } = await import(
        "@/lib/agents/appointment-booking/sync-company-brain-from-wizard"
      );
      await syncCompanyBrainFromWizard(auth.workspaceId, state);
    } catch (err) {
      warnings.push(
        `Company Brain sync: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const shouldPublish =
      effectiveAction === "activate" &&
      (activationMode === "activate_now" || activationMode === "duplicate_location");

    // Scheduled activation: persist DRAFT with schedule metadata, do not publish yet.
    const scheduleOnly =
      effectiveAction === "activate" &&
      activationMode === "schedule" &&
      Boolean(state.scheduledAt?.trim());

    if (
      (shouldPublish || scheduleOnly) &&
      hasBlockingActivationIssues(hooks.issues)
    ) {
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

    // Scheduling must not demote an already-live ACTIVE agent to DRAFT (that
    // would stop inbound AI until the scheduled promote runs).
    const existingAgent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
      select: { status: true },
    });
    const preserveActiveOnSchedule =
      scheduleOnly && existingAgent?.status === "ACTIVE";

    const updated = await updateVoiceAgentDraft(auth.workspaceId, agentId, {
      name,
      description: `${productAgentType} — wizard setup`,
      agentType: productAgentType,
      displayName: state.agentName || name,
      purpose: "appointment_receptionist",
      phoneNumberId: shouldPublish ? state.phoneNumberId : state.phoneNumberId,
      draftConfig: configWithKb,
      status: shouldPublish || preserveActiveOnSchedule ? undefined : "DRAFT",
    });

    // Long-term memory via VoiceMemoryConfig — enable or explicitly disable.
    if (shouldPublish || scheduleOnly || effectiveAction !== "create_draft") {
      try {
        const { saveMemoryConfig } = await import("@/lib/voice/platform/ai-platform");
        if (state.longTermMemory) {
          await saveMemoryConfig(auth.workspaceId, agentId, {
            mode: "caller",
            retentionDays: 30,
          });
        } else {
          await saveMemoryConfig(auth.workspaceId, agentId, {
            mode: "none",
            retentionDays: 0,
          });
        }
      } catch {
        if (state.longTermMemory) {
          warnings.push(
            "Could not enable long-term memory — configure it later in AI platform.",
          );
        }
      }
    }

    let published = false;
    let publishError: string | null = null;
    let previousAiOwner: { id: string; name: string } | null = null;
    let clonedAgentId: string | null = null;
    let triggerDeployments: unknown[] = [];
    let primaryFlowId: string | null = null;
    let workflowCompileError: string | null = null;

    // Connected architecture: durable SolutionSetup ↔ VoiceAgent link + primary flow.
    // Save first so Activate can compile TriggerDeployment from the canvas.
    const setup = await upsertAppointmentReceptionistSetup({
      workspaceId: auth.workspaceId,
      agentId,
      state: { ...state, agentId },
      published:
        !shouldPublish &&
        (preserveActiveOnSchedule || existingAgent?.status === "ACTIVE"),
      links: {
        calendarConnectionId: hooks.calendarConnectionId,
      },
    });
    primaryFlowId = setup.primaryFlowId || null;
    workflowCompileError = setup.workflowCompileError || null;
    if (workflowCompileError) {
      warnings.push(`Workflow compile: ${workflowCompileError}`);
    }

    if (shouldPublish) {
      if (!state.phoneNumberId) {
        return NextResponse.json(
          {
            error: "Phone number required",
            data: {
              agentId,
              setupId: setup.setupId,
              primaryFlowId,
              published: false,
              issues: [
                {
                  severity: "error",
                  message: "Phone number required before Activate",
                },
              ],
              warnings,
            },
          },
          { status: 400 },
        );
      }
      if (!primaryFlowId) {
        return NextResponse.json(
          {
            error: "Primary workflow missing — resave the agent first",
            data: {
              agentId,
              setupId: setup.setupId,
              published: false,
              workflowCompileError,
              warnings,
            },
          },
          { status: 400 },
        );
      }

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

      // Activation transaction: validate → TriggerDeployment → Telnyx → ACTIVE.
      // Do NOT mark workflow active if Telnyx publish fails.
      try {
        const prisma = getPrisma();
        const flow = await prisma.automationFlow.findFirst({
          where: { id: primaryFlowId, workspaceId: auth.workspaceId },
        });
        if (!flow) throw new Error("Primary workflow not found");

        const { activateFlowTriggers } = await import(
          "@/lib/automations/trigger-deployments"
        );
        const { parseAutomationDefinition } = await import(
          "@/lib/automations/types"
        );
        const def = parseAutomationDefinition(flow.definition);
        const triggerResult = await activateFlowTriggers(
          auth.workspaceId,
          primaryFlowId,
          def,
          // Always claim the DID on Activate so the new agent replaces any
          // prior live TriggerDeployment / AI owner for this number.
          { forceTakeover: true },
        );
        if (triggerResult.conflicts.length) {
          return NextResponse.json(
            {
              error: "Trigger conflict",
              conflicts: triggerResult.conflicts,
              message: triggerResult.conflicts[0]?.message,
              data: {
                agentId,
                setupId: setup.setupId,
                primaryFlowId,
                published: false,
              },
            },
            { status: 409 },
          );
        }

        // Voice inbound: refuse to mark ACTIVE without Telnyx publish proof.
        if (!triggerResult.telnyxPublished) {
          throw new Error(
            "Activation did not publish Telnyx routing — workflow left inactive",
          );
        }

        const newVersion = Math.max(1, (flow.version || 0) + 1);
        await prisma.automationFlow.update({
          where: { id: primaryFlowId },
          data: {
            status: "ACTIVE",
            version: newVersion,
            publishedDefinition: flow.definition as object,
            publishedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        published = true;
        triggerDeployments = triggerResult.deployments;

        await upsertAppointmentReceptionistSetup({
          workspaceId: auth.workspaceId,
          agentId,
          state: { ...state, agentId },
          published: true,
          links: {
            calendarConnectionId: hooks.calendarConnectionId,
          },
        });
      } catch (err) {
        publishError =
          err instanceof Error ? err.message : "Activation / Telnyx publish failed";
        published = false;
      }

      // Duplicate for another location: clone agent with same config, leave as DRAFT
      // (no phone assigned) so the second office can be wired separately.
      if (activationMode === "duplicate_location" && published) {
        try {
          const copyName = `${name} (copy)`;
          const clone = await createVoiceAgent(auth.workspaceId, {
            name: copyName,
            agentType: productAgentType,
            templateId: "appointment_booking",
            description: `Cloned ${productAgentType} wizard agent`,
          });
          const cloneConfig = parseVoiceAgentConfig(configWithKb);
          // Don't bind the copy to the same DID.
          await updateVoiceAgentDraft(auth.workspaceId, clone.id, {
            name: copyName,
            description: `Cloned ${productAgentType} wizard agent`,
            agentType: productAgentType,
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
          await upsertAppointmentReceptionistSetup({
            workspaceId: auth.workspaceId,
            agentId: clone.id,
            state: {
              ...state,
              agentId: clone.id,
              setupId: undefined,
              phoneNumberId: null,
              solutionName: copyName,
            },
            published: false,
            links: {
              calendarConnectionId: hooks.calendarConnectionId,
            },
          }).catch(() => undefined);
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
        preserveActiveOnSchedule
          ? `Activation changes scheduled for ${state.scheduledAt} — live agent stays ACTIVE until then.`
          : `Activation scheduled for ${state.scheduledAt} — agent kept as DRAFT until then.`,
      );
      // Keep setup linked for schedule; mark published only if already live.
      await upsertAppointmentReceptionistSetup({
        workspaceId: auth.workspaceId,
        agentId,
        state: { ...state, agentId },
        published:
          preserveActiveOnSchedule || existingAgent?.status === "ACTIVE",
        links: {
          calendarConnectionId: hooks.calendarConnectionId,
        },
      });
    }

    return NextResponse.json({
      data: {
        agentId,
        setupId: setup.setupId,
        outcomeSlug: setup.outcomeSlug,
        primaryFlowId,
        workflowCompileError,
        triggerDeployments,
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
