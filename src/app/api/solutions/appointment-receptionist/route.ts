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
  WizardStepId,
} from "@/lib/solutions/appointment-receptionist/types";
import { mergeWizardStateForSave } from "@/lib/solutions/appointment-receptionist/merge-wizard-state-on-save";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  loadAppointmentReceptionistSetup,
  outcomeSlugFromWizard,
  upsertAppointmentReceptionistSetup,
} from "@/lib/solutions/appointment-receptionist/save-setup";
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";
import { uniqueAgentDisplayName } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { validateReceptionistPhoneSelection } from "@/lib/solutions/appointment-receptionist/validate-phone-selection";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    let setupId = url.searchParams.get("setupId") || undefined;
    let agentId = url.searchParams.get("agentId") || undefined;
    if (!setupId && !agentId) {
      const { resolveCanonicalVoiceV3WorkspaceAgent } = await import(
        "@/lib/voice-v3/canonical-workspace-agent"
      );
      const canonical = await resolveCanonicalVoiceV3WorkspaceAgent(auth.workspaceId);
      if (canonical?.agentId) {
        agentId = canonical.agentId;
      }
    }
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
      wizardStepId?: WizardStepId;
    };

    const action = body.action || "save_draft";
    let state = body.state;
    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "state is required" }, { status: 400 });
    }

    // Activate must publish the full wizard form in the request body — not a stale per-step
    // server merge (activate step only owns activationMode/scheduledAt).
    if (
      state.agentId &&
      body.wizardStepId &&
      action !== "create_draft" &&
      action !== "activate"
    ) {
      const existing = await loadAppointmentReceptionistSetup(auth.workspaceId, {
        agentId: state.agentId,
      });
      if (existing?.state) {
        state = mergeWizardStateForSave(
          existing.state as AppointmentReceptionistWizardState,
          state,
          body.wizardStepId,
        );
      }
    }

    let activationMode = state.activationMode || "activate_now";
    const warnings: string[] = [];

    // Product: one activation path — publish immediately. Scheduled / duplicate-location UI removed.
    if (action === "activate") {
      if (activationMode === "save_draft") {
        warnings.push("Use save draft action to keep editing without publishing.");
      } else if (activationMode === "schedule" || activationMode === "duplicate_location") {
        warnings.push(
          "Scheduled and duplicate-location activation are no longer supported — publishing now.",
        );
      }
      activationMode = "activate_now";
      state.activationMode = "activate_now";
      state.scheduledAt = null;
    }

    let effectiveAction: WizardPersistAction | "activate" = action;

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

    const shouldPublish = effectiveAction === "activate";

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

    const existingAgent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
      select: { status: true, publishedVersionId: true, phoneNumberId: true },
    });
    const preserveActiveOnDraftSave =
      effectiveAction === "save_draft" && existingAgent?.status === "ACTIVE";

    const { isAppointmentReceptionistAgent } = await import(
      "@/lib/voice-v3/config/from-published-agent"
    );
    const receptionistAgent = isAppointmentReceptionistAgent(configWithKb);

    if (state.phoneNumberId && receptionistAgent) {
      const phoneValidation = await validateReceptionistPhoneSelection({
        workspaceId: auth.workspaceId,
        phoneNumberId: state.phoneNumberId,
        agentId,
        allowTakeoverFromOtherAgent: shouldPublish,
      });
      if (!phoneValidation.ok) {
        return NextResponse.json(
          {
            error: phoneValidation.error,
            data: {
              agentId,
              issues: [
                {
                  severity: "error",
                  message: phoneValidation.error,
                  id: phoneValidation.code,
                },
              ],
              warnings,
            },
          },
          { status: 400 },
        );
      }
      if (
        preserveActiveOnDraftSave &&
        state.phoneNumberId !== existingAgent?.phoneNumberId
      ) {
        return NextResponse.json(
          {
            error:
              "Changing the assigned phone on a live receptionist requires activation with takeover. Save other settings or use Activate.",
            data: {
              agentId,
              issues: [
                {
                  severity: "error",
                  message:
                    "Live receptionist phone changes are not applied from draft save alone.",
                  id: "active_phone_change_blocked",
                },
              ],
              warnings,
            },
          },
          { status: 400 },
        );
      }
    }

    const phonePatchForDraft =
      preserveActiveOnDraftSave && state.phoneNumberId === existingAgent?.phoneNumberId
        ? undefined
        : state.phoneNumberId;

    const updated = await updateVoiceAgentDraft(auth.workspaceId, agentId, {
      name,
      description: `${productAgentType} — wizard setup`,
      agentType: productAgentType,
      displayName: state.agentName || name,
      purpose: "appointment_receptionist",
      phoneNumberId: shouldPublish ? state.phoneNumberId : phonePatchForDraft,
      draftConfig: configWithKb,
      status: shouldPublish || preserveActiveOnDraftSave ? undefined : "DRAFT",
    });

    let liveSyncApplied = false;
    let liveSyncError: string | null = null;

    if (preserveActiveOnDraftSave && state.phoneNumberId) {
      const { syncLiveWizardDraftToProvider } = await import("@/lib/voice/agent-service");
      const liveSync = await syncLiveWizardDraftToProvider(auth.workspaceId, agentId);
      if (!liveSync.synced && liveSync.error && liveSync.error !== "not_live") {
        liveSyncError = liveSync.error;
        const authoritativeOnSyncFail = await loadAppointmentReceptionistSetup(
          auth.workspaceId,
          { agentId },
        );
        return NextResponse.json(
          {
            error: "Saved, but live configuration could not be updated",
            data: {
              agentId,
              liveSyncApplied: false,
              liveSyncError,
              liveSyncPending: true,
              state: authoritativeOnSyncFail?.state ?? state,
              issues: hooks.issues,
              warnings: [
                ...warnings,
                "Your changes were saved. Live calls still use the previous configuration until sync succeeds — try saving again.",
              ],
            },
          },
          { status: 422 },
        );
      }
      liveSyncApplied = liveSync.synced;
    }

    // Long-term memory via VoiceMemoryConfig — enable or explicitly disable.
    if (shouldPublish || effectiveAction !== "create_draft") {
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
        (preserveActiveOnDraftSave || existingAgent?.status === "ACTIVE"),
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

      const { recoverIncompleteReceptionistActivation } = await import(
        "@/lib/solutions/appointment-receptionist/activation-recovery"
      );
      const recoveryInput = {
        workspaceId: auth.workspaceId,
        agentId,
        primaryFlowId,
        phoneNumberId: state.phoneNumberId!,
        userId: auth.session.userId,
      };

      const preRecovery = await recoverIncompleteReceptionistActivation(recoveryInput);
      if (preRecovery.recovered) {
        published = true;
        triggerDeployments = preRecovery.triggerDeployments || [];
        const { VOICE_AGENT_HEALTH_OK } = await import("@/lib/voice/agent-health-status");
        await getPrisma().voiceAgent.update({
          where: { id: agentId, workspaceId: auth.workspaceId },
          data: { healthStatus: VOICE_AGENT_HEALTH_OK, healthMessage: null },
        });
        await upsertAppointmentReceptionistSetup({
          workspaceId: auth.workspaceId,
          agentId,
          state: { ...state, agentId },
          published: true,
          links: { calendarConnectionId: hooks.calendarConnectionId },
        });
      }

      // Activation transaction: validate → TriggerDeployment → Telnyx → ACTIVE.
      // Do NOT mark workflow active if Telnyx publish fails.
      if (!published) {
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

        triggerDeployments = triggerResult.deployments;

        if (state.phoneNumberId && receptionistAgent) {
          const { setActiveCallHandler } = await import(
            "@/lib/call-handling/set-active-call-handler"
          );
          await setActiveCallHandler({
            workspaceId: auth.workspaceId,
            voiceIngressPhoneNumberId: state.phoneNumberId,
            handler: "ai_receptionist",
            userId: auth.session.userId,
          });
        }

        const refreshedAgent = await getPrisma().voiceAgent.findFirst({
          where: { id: agentId, workspaceId: auth.workspaceId },
          select: { status: true, publishedVersionId: true },
        });
        if (refreshedAgent?.status !== "ACTIVE" || !refreshedAgent.publishedVersionId) {
          throw new Error(
            "Activation did not reach ACTIVE with a published version — try again",
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

        if (published && state.phoneNumberId) {
          const { isMctbV1Primary } = await import("@/lib/workspace/platform-launch");
          if (isMctbV1Primary()) {
            const { persistMctbLineInboundConfig } = await import(
              "@/lib/mctb/inbound-handling/line-config"
            );
            await persistMctbLineInboundConfig({
              workspaceId: auth.workspaceId,
              phoneNumberId: state.phoneNumberId,
              patch: { voiceAgentId: agentId },
            }).catch(() => undefined);

            const { hasExplicitCallHandlingSelection } = await import(
              "@/lib/call-handling/phone-settings"
            );
            const phoneRow = await getPrisma().phoneNumber.findFirst({
              where: { id: state.phoneNumberId, workspaceId: auth.workspaceId },
              select: { settingsJson: true },
            });
            const explicitCallHandling = hasExplicitCallHandlingSelection(
              phoneRow?.settingsJson,
            );

            if (!explicitCallHandling) {
              const { persistInitialCallHandlerIfUnset } = await import(
                "@/lib/call-handling/initial-selection"
              );
              await persistInitialCallHandlerIfUnset({
                workspaceId: auth.workspaceId,
                phoneNumberId: state.phoneNumberId,
                handler: "ai_receptionist",
                aiReceptionistAgentId: agentId,
                userId: auth.session.userId,
              }).catch(() => undefined);
            }
          }
        }

        await getPrisma().voiceAgent.update({
          where: { id: agentId },
          data: { healthStatus: "ok", healthMessage: null },
        });

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

        const postFailureRecovery =
          await recoverIncompleteReceptionistActivation(recoveryInput);
        if (postFailureRecovery.recovered) {
          published = true;
          publishError = null;
          triggerDeployments = postFailureRecovery.triggerDeployments || [];
          await upsertAppointmentReceptionistSetup({
            workspaceId: auth.workspaceId,
            agentId,
            state: { ...state, agentId },
            published: true,
            links: { calendarConnectionId: hooks.calendarConnectionId },
          });
        } else if (primaryFlowId) {
          const agentRow = await getPrisma().voiceAgent.findFirst({
            where: { id: agentId, workspaceId: auth.workspaceId },
            select: { status: true },
          });
          if (agentRow?.status !== "ACTIVE") {
            await getPrisma()
              .automationFlow.update({
                where: { id: primaryFlowId, workspaceId: auth.workspaceId },
                data: { status: "DRAFT", updatedAt: new Date() },
              })
              .catch(() => undefined);
          }
        }
      }
      }

    }

    const authoritative = await loadAppointmentReceptionistSetup(auth.workspaceId, {
      agentId,
      setupId: setup.setupId,
    });
    const { isLiveSyncPendingHealthStatus } = await import("@/lib/voice/agent-health-status");

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
        liveSyncApplied,
        liveSyncError,
        liveSyncPending:
          Boolean(liveSyncError) ||
          isLiveSyncPendingHealthStatus(authoritative?.healthStatus),
        healthStatus: authoritative?.healthStatus ?? null,
        healthMessage: authoritative?.healthMessage ?? null,
        state: authoritative?.state ?? state,
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
