import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "./types";
import { validateAgentForPublish, hasBlockingIssues } from "./validation";
import { templateConfig } from "./templates";

export async function createVoiceAgent(
  workspaceId: string,
  input: {
    name: string;
    agentType?: string;
    templateId?: string;
    description?: string;
  },
) {
  const prisma = getPrisma();
  let config = input.templateId
    ? templateConfig(input.templateId)
    : parseVoiceAgentConfig(null);

  // Product default: Flux + TeXML direct (skip Call Control before first audio).
  const { ensureDefaultLatencyProfile } = await import(
    "./telnyx/texml-direct-route"
  );
  config = ensureDefaultLatencyProfile(config);

  // Attach a default visual flow bundle for the agent type / template.
  try {
    const { defaultFlowBundleForAgentType, getVoiceFlowTemplate } = await import(
      "./flow/templates"
    );
    const flowTemplate = input.templateId
      ? getVoiceFlowTemplate(input.templateId) ||
        getVoiceFlowTemplate(
          input.templateId === "receptionist" ? "full_receptionist" : "answering_machine",
        )
      : null;
    const bundle =
      flowTemplate?.bundle ||
      defaultFlowBundleForAgentType(input.agentType || input.templateId);
    (config as VoiceAgentConfig).flows = bundle;
  } catch {
    // optional
  }

  return prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      agentType: input.agentType || input.templateId || "custom",
      description: input.description,
      draftConfig: config as object,
      status: "DRAFT",
    },
  });
}

export async function updateVoiceAgentDraft(
  workspaceId: string,
  agentId: string,
  patch: {
    name?: string;
    description?: string;
    agentType?: string;
    displayName?: string;
    purpose?: string;
    phoneNumberId?: string | null;
    status?: string;
    draftConfig?: VoiceAgentConfig;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!existing) throw new Error("Agent not found");

  const prevConfig = parseVoiceAgentConfig(existing.draftConfig);
  let nextConfig = patch.draftConfig
    ? {
        ...prevConfig,
        ...patch.draftConfig,
        // Deep-merge nested objects so activate hooks / wizard patches don't wipe each other.
        identity: {
          ...(prevConfig.identity || {}),
          ...(patch.draftConfig.identity || {}),
        },
        instructions: {
          ...(prevConfig.instructions || {}),
          ...(patch.draftConfig.instructions || {}),
        },
        callHandling: {
          ...(prevConfig.callHandling || {}),
          ...(patch.draftConfig.callHandling || {}),
          startupGreeting: {
            ...((prevConfig.callHandling as { startupGreeting?: object } | undefined)
              ?.startupGreeting || {}),
            ...((patch.draftConfig.callHandling as { startupGreeting?: object } | undefined)
              ?.startupGreeting || {}),
          },
        },
        transfers: {
          ...(prevConfig.transfers || {}),
          ...(patch.draftConfig.transfers || {}),
        },
        messaging: {
          ...(prevConfig.messaging || {}),
          ...(patch.draftConfig.messaging || {}),
        },
        compliance: {
          ...(prevConfig.compliance || {}),
          ...(patch.draftConfig.compliance || {}),
        },
        advanced: {
          ...(prevConfig.advanced || {}),
          ...(patch.draftConfig.advanced || {}),
        },
        voiceLanguage: {
          ...(prevConfig.voiceLanguage || {}),
          ...(patch.draftConfig.voiceLanguage || {}),
        },
        transcription: {
          ...(prevConfig.transcription || {}),
          ...(patch.draftConfig.transcription || {}),
        },
        voiceTiming: {
          ...(prevConfig.voiceTiming || {}),
          ...(patch.draftConfig.voiceTiming || {}),
        },
        postCall: {
          ...(prevConfig.postCall || {}),
          ...(patch.draftConfig.postCall || {}),
        },
      }
    : prevConfig;

  // Flux profiles must not keep a leftover local endpointingMs from a prior cascade.
  {
    const { isFluxEagerLatencyProfile } = await import("./latency-profiles");
    if (isFluxEagerLatencyProfile(nextConfig.voiceTiming?.activeProfile)) {
      const vl = { ...(nextConfig.voiceLanguage || {}) };
      delete vl.endpointingMs;
      nextConfig = { ...nextConfig, voiceLanguage: vl };
    }
  }

  const updated = await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      name: patch.name?.trim() || undefined,
      description: patch.description ?? undefined,
      agentType: patch.agentType || undefined,
      displayName: patch.displayName ?? undefined,
      purpose: patch.purpose ?? undefined,
      phoneNumberId:
        patch.phoneNumberId === null ? null : patch.phoneNumberId || undefined,
      status: patch.status || undefined,
      draftConfig: nextConfig as object,
      updatedAt: new Date(),
    },
  });

  if (patch.phoneNumberId !== undefined) {
    const { syncVoiceAgentPhoneAssignment } = await import("./agent-phone");
    // Drafts reserve the DID without stealing a live ACTIVE agent's inbound ownership.
    // Publish/activate claims exclusively via publishVoiceAgent → sync (exclusive).
    const nextStatus = patch.status || existing.status;
    const exclusive = nextStatus === "ACTIVE";
    await syncVoiceAgentPhoneAssignment({
      workspaceId,
      agentId,
      phoneNumberId: patch.phoneNumberId,
      exclusive,
    });

    // LiveKit: provision Telnyx FQDN + shared trunk when an ACTIVE agent gets a DID.
    // No separate script — matches Coolify LIVEKIT_URL / LIVEKIT_* env as-is.
    if (patch.phoneNumberId && nextStatus === "ACTIVE") {
      const { isLiveKitVoiceRuntime } = await import("./runtime-provider");
      if (isLiveKitVoiceRuntime()) {
        const { ensureNumberProvisioned } = await import(
          "@/lib/telephony/provisioning"
        );
        await ensureNumberProvisioned({
          workspaceId,
          phoneNumberId: patch.phoneNumberId,
          agentId,
          routingMode: "livekit_sip",
        }).catch((err) =>
          console.error(
            "[voice] LiveKit number provision failed",
            err instanceof Error ? err.message : err,
          ),
        );
      }
    }
  }

  return updated;
}

async function syncAssistantToTelnyx(
  workspaceId: string,
  agentId: string,
  agent: { id: string; telnyxAssistantId: string | null; agentType?: string | null },
  config: VoiceAgentConfig,
) {
  const { getVoiceRuntimeProvider, isLiveKitVoiceRuntime } = await import(
    "./runtime-provider"
  );
  const { requiresLiveKitVoiceRuntime } = await import("./architecture/livekit-voice-profiles");
  if (requiresLiveKitVoiceRuntime({ ...config, agentType: agent.agentType })) {
    await getVoiceRuntimeProvider().syncAgentConfig?.({ workspaceId, agentId });
    return { skipped: true, reason: "livekit_only_profile" };
  }
  if (isLiveKitVoiceRuntime()) {
    await getVoiceRuntimeProvider().syncAgentConfig?.({ workspaceId, agentId });
    return { skipped: true, reason: "livekit_runtime" };
  }

  const { syncTelnyxAssistant } = await import("./telnyx/assistant-sync");
  const sync = await syncTelnyxAssistant(workspaceId, agent as never, config);
  const assistantId =
    (sync as { assistantId?: string })?.assistantId || agent.telnyxAssistantId;
  if (!assistantId) return null;

  const platform = await import("./platform/ai-platform");
  // Ensure Transovo MCP is registered/approved before enrich attaches it.
  await platform.ensureTransovoMcpServer(workspaceId).catch(() => undefined);
  await platform
    .enrichAssistantRemoteConfig({
      workspaceId,
      agentId,
      telnyxAssistantId: assistantId,
    })
    .catch((err) =>
      console.warn(
        "[voice] enrich remote config failed",
        err instanceof Error ? err.message : err,
      ),
    );
  return sync;
}

/**
 * Build agent for in-app testing (Telnyx sync → TESTING).
 * Does not require a phone number and does not accept production inbound.
 */
export async function buildVoiceAgentForTest(
  workspaceId: string,
  agentId: string,
  publishedBy?: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  if (agent.emergencyDisabled) throw new Error("Agent emergency-disabled");

  // Compile visual flows → instructions, tools, routing before Telnyx sync.
  const { applyFlowToAgentDraft } = await import("./flow/apply");
  const applied = await applyFlowToAgentDraft({
    workspaceId,
    agentId,
    agentType: agent.agentType,
    draftConfig: parseVoiceAgentConfig(agent.draftConfig),
    strict: false,
  });
  const { recompileReceptionistFromDraft } = await import("./receptionist/recompile");
  const config = recompileReceptionistFromDraft(applied.config);
  const issues = validateAgentForPublish(agent.name, config, {
    requirePhone: false,
    phoneNumberId: agent.phoneNumberId,
  });
  if (hasBlockingIssues(issues)) {
    const err = new Error("Build validation failed");
    (err as Error & { issues: typeof issues }).issues = issues;
    throw err;
  }

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;
  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId,
      version,
      config: config as object,
      publishedBy,
      testStatus: "ready_for_test",
      deploymentStatus: "testing",
      isMain: false,
    },
  });

  let updated = await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      publishedVersionId: versionRow.id,
      status: "TESTING",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  try {
    const sync = await syncAssistantToTelnyx(
      workspaceId,
      agentId,
      updated,
      config,
    );
    const assistantId =
      sync && typeof sync === "object" && "assistantId" in sync
        ? String((sync as { assistantId?: string }).assistantId || "")
        : typeof sync === "string"
          ? sync
          : null;
    updated = (await prisma.voiceAgent.findUnique({ where: { id: agentId } })) || updated;
    if (!assistantId && !updated.telnyxAssistantId) {
      updated = await prisma.voiceAgent.update({
        where: { id: agentId },
        data: {
          healthStatus: "warning",
          healthMessage:
            "Built locally but Telnyx did not return an assistant id — check TELNYX_API_KEY and Build again",
        },
      });
    }
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    console.error("[voice] Telnyx build sync failed", detail);
    updated = await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        healthStatus: "warning",
        healthMessage: `Built locally but Telnyx sync failed: ${detail.slice(0, 500)}`,
      },
    });
  }

  return { agent: updated, version: versionRow };
}

/**
 * Deploy agent to production (ACTIVE) and assign DID for inbound.
 */
export async function publishVoiceAgent(
  workspaceId: string,
  agentId: string,
  publishedBy?: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const { applyFlowToAgentDraft } = await import("./flow/apply");
  const applied = await applyFlowToAgentDraft({
    workspaceId,
    agentId,
    agentType: agent.agentType,
    draftConfig: parseVoiceAgentConfig(agent.draftConfig),
    strict: true,
  }).catch((err) => {
    if (err && typeof err === "object" && "issues" in err) throw err;
    throw err;
  });
  const { recompileReceptionistFromDraft } = await import("./receptionist/recompile");
  const config = recompileReceptionistFromDraft(applied.config);
  const issues = validateAgentForPublish(agent.name, config, {
    requirePhone:
      !config.identity?.directions?.length ||
      config.identity.directions.includes("inbound"),
    phoneNumberId: agent.phoneNumberId,
  });
  if (hasBlockingIssues(issues)) {
    const err = new Error("Deploy validation failed — assign a phone number under Identity");
    (err as Error & { issues: typeof issues }).issues = issues;
    throw err;
  }

  // Gate deploy when regression suite has a failing result (or hard-require when env set).
  const requireSuite = process.env.VOICE_PUBLISH_REQUIRE_SUITE === "1";
  const latestSuiteRun = await prisma.voiceAssistantTestRun.findFirst({
    where: {
      workspaceId,
      suiteName: "transovo-default",
    },
    orderBy: { createdAt: "desc" },
  });
  const suiteFailed =
    latestSuiteRun &&
    ["failed", "error", "fail"].includes(String(latestSuiteRun.status).toLowerCase());
  if (suiteFailed) {
    throw new Error(
      "Deploy blocked: latest transovo-default suite run failed — fix tests or clear the failing run",
    );
  }
  if (requireSuite && !latestSuiteRun) {
    throw new Error(
      "Deploy blocked: VOICE_PUBLISH_REQUIRE_SUITE=1 and no suite run found — run seed_suite/run_suite first",
    );
  }

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId,
      version,
      config: config as object,
      publishedBy,
      testStatus: latestSuiteRun?.status || (requireSuite ? "required" : "skipped"),
      deploymentStatus: "deployed",
      isMain: true,
    },
  });

  const previousStatus = agent.status;
  const updated = await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      publishedVersionId: versionRow.id,
      status: "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  const rollbackPublish = async (message: string) => {
    await prisma.voiceAgent
      .update({
        where: { id: agentId },
        data: {
          status: previousStatus === "ACTIVE" ? "DRAFT" : previousStatus,
          healthStatus: "error",
          healthMessage: message.slice(0, 500),
        },
      })
      .catch(() => undefined);
    throw new Error(message);
  };

  try {
    const { syncVoiceAgentPhoneAssignment } = await import("./agent-phone");
    await syncVoiceAgentPhoneAssignment({
      workspaceId,
      agentId,
      phoneNumberId: updated.phoneNumberId,
      exclusive: true,
    });
  } catch (err) {
    console.error("[voice] phone assignment sync failed", err);
  }

  let telnyxSync: unknown = null;
  let livekitProvision: unknown = null;
  const { isLiveKitVoiceRuntime } = await import("./runtime-provider");

  try {
    telnyxSync = await syncAssistantToTelnyx(workspaceId, agentId, updated, config);
  } catch (err) {
    const telnyxSyncError = err instanceof Error ? err.message : String(err);
    console.error("[voice] Telnyx assistant sync failed", err);
    if (!isLiveKitVoiceRuntime()) {
      await rollbackPublish(
        `Telnyx assistant sync failed — deploy rolled back: ${telnyxSyncError}`,
      );
    }
  }

  const refreshedAfterSync =
    (await prisma.voiceAgent.findUnique({ where: { id: agentId } })) || updated;

  if (!isLiveKitVoiceRuntime() && !refreshedAfterSync.telnyxAssistantId) {
    await rollbackPublish(
      "Telnyx assistant id missing after sync — deploy rolled back",
    );
  }

  // Product default (Telnyx): point the DID at TeXML → assistant.
  // LiveKit: provision shared SIP trunk + Telnyx FQDN route via API.
  let texmlRoute: {
    matched?: boolean;
    path?: string;
    texmlAppId?: string;
  } | null = null;

  if (isLiveKitVoiceRuntime() && updated.phoneNumberId) {
    const { ensureNumberProvisioned } = await import(
      "@/lib/telephony/provisioning"
    );
    livekitProvision = await ensureNumberProvisioned({
      workspaceId,
      phoneNumberId: updated.phoneNumberId,
      agentId,
      routingMode: "livekit_sip",
    });
    if (!(livekitProvision as { ok?: boolean }).ok) {
      const detail =
        (livekitProvision as { error?: string }).error || "LiveKit provisioning failed";
      await rollbackPublish(`LiveKit provisioning failed — deploy rolled back: ${detail}`);
    }
  } else {
    const {
      usesTexmlDirectInbound,
      routePhoneToTexmlAssistant,
    } = await import("./telnyx/texml-direct-route");
    if (usesTexmlDirectInbound(config) && updated.phoneNumberId) {
      const phone = await prisma.phoneNumber.findFirst({
        where: { id: updated.phoneNumberId, workspaceId },
        select: { e164: true, providerNumberId: true },
      });
      if (!phone?.e164) {
        await rollbackPublish(
          "Phone number missing for TeXML direct route — deploy rolled back",
        );
      }
      try {
        texmlRoute = await routePhoneToTexmlAssistant({
          e164: phone!.e164,
          assistantId: refreshedAfterSync.telnyxAssistantId!,
          providerNumberId: phone!.providerNumberId,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error("[voice] TeXML direct route failed", err);
        await rollbackPublish(
          `TeXML direct routing failed — deploy rolled back: ${detail}`,
        );
      }
      if (!texmlRoute?.matched) {
        await rollbackPublish(
          `TeXML route did not match live connection — deploy rolled back (${texmlRoute?.path || "no path"})`,
        );
      }
    }
  }

  return {
    agent: refreshedAfterSync,
    version: versionRow,
    telnyxSync,
    telnyxSyncError: null as string | null,
    texmlRoute,
    livekitProvision,
  };
}

export async function rollbackVoiceAgent(
  workspaceId: string,
  agentId: string,
  versionId: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const version = await prisma.voiceAgentVersion.findFirst({
    where: { id: versionId, agentId, workspaceId },
  });
  if (!version) throw new Error("Version not found");

  const config = parseVoiceAgentConfig(version.config);
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      draftConfig: config as object,
      status: "DRAFT",
    },
  });

  // Re-publish the rolled-back config so Telnyx stays in sync.
  return publishVoiceAgent(workspaceId, agentId, "rollback");
}

export async function duplicateVoiceAgent(workspaceId: string, agentId: string) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  return prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: `${agent.name} (copy)`,
      description: agent.description,
      agentType: agent.agentType,
      displayName: agent.displayName,
      purpose: agent.purpose,
      draftConfig: agent.draftConfig as object,
      status: "DRAFT",
    },
  });
}

export async function getPublishedConfig(
  agentId: string,
): Promise<VoiceAgentConfig | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!agent?.publishedVersionId) return null;
  const ver = await prisma.voiceAgentVersion.findUnique({
    where: { id: agent.publishedVersionId },
  });
  if (!ver) return null;
  return parseVoiceAgentConfig(ver.config);
}
