/**
 * Transovo AI Voice platform orchestration.
 * Customer setting → DB → Telnyx ai-client → stored external IDs → diagnostics.
 */

import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import * as ai from "@/lib/voice/telnyx/ai-client";
import { capabilityRegistrySnapshot } from "@/lib/voice/telnyx/capability-registry";
import { TelnyxApiError } from "@/lib/messaging/telnyx/client";

function asData<T = Record<string, unknown>>(res: unknown): T {
  if (res && typeof res === "object" && "data" in (res as object)) {
    return (res as { data: T }).data;
  }
  return res as T;
}

async function requireAgent(workspaceId: string, agentId: string) {
  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  if (agent.emergencyDisabled) throw new Error("Agent emergency-disabled");
  return agent;
}

function telnyxOrMock<T>(fn: () => Promise<T>, mock: T): Promise<T> {
  if (!ai.isTelnyxAiConfigured()) return Promise.resolve(mock);
  return fn();
}

export async function getAiPlatformDiagnostics(workspaceId: string) {
  const prisma = getPrisma();
  const [agents, mcp, canaries, tests, scheduled, conversations, concurrency] =
    await Promise.all([
      prisma.voiceAgent.count({ where: { workspaceId } }),
      prisma.voiceMcpServer.count({ where: { workspaceId } }),
      prisma.voiceCanaryDeploy.count({ where: { workspaceId } }),
      prisma.voiceAssistantTest.count({ where: { workspaceId } }),
      prisma.voiceScheduledEvent.count({ where: { workspaceId } }),
      prisma.voiceAiConversation.count({ where: { workspaceId } }),
      prisma.voiceConcurrencyAllocation.findUnique({ where: { workspaceId } }),
    ]);
  return {
    telnyxConfigured: ai.isTelnyxAiConfigured(),
    registry: capabilityRegistrySnapshot(),
    counts: { agents, mcp, canaries, tests, scheduled, conversations },
    concurrency: concurrency || {
      maxInboundAi: 5,
      maxOutboundAi: 0,
      maxTransferLegs: 10,
    },
  };
}

/** Attach dynamic_variables_webhook_url + privacy/insights/mcp on publish sync. */
export async function enrichAssistantRemoteConfig(input: {
  workspaceId: string;
  agentId: string;
  telnyxAssistantId: string;
}) {
  if (!ai.isTelnyxAiConfigured()) return { skipped: true };
  const prisma = getPrisma();
  const base = getAppBaseUrl();
  const agent = await requireAgent(input.workspaceId, input.agentId);

  const memory = await prisma.voiceMemoryConfig.findFirst({
    where: { workspaceId: input.workspaceId, agentId: input.agentId },
    orderBy: { updatedAt: "desc" },
  });
  const obs = await prisma.voiceObservabilityConfig.findFirst({
    where: { workspaceId: input.workspaceId, agentId: input.agentId },
  });
  const mcpLinks = await prisma.voiceMcpServer.findMany({
    where: {
      workspaceId: input.workspaceId,
      approved: true,
      status: "active",
      telnyxMcpId: { not: null },
    },
    take: 10,
  });

  const body: Record<string, unknown> = {
    dynamic_variables_webhook_url: `${base}/api/telnyx/voice/dynamic-variables`,
    dynamic_variables_webhook_timeout_ms: 1500,
  };

  if (memory) {
    body.privacy_settings = {
      ...(memory.telnyxPrivacyJson as object),
      // Store conversation history when memory mode is not "none"
      data_retention: memory.mode !== "none",
    };
  }
  if (agent.insightGroupId) {
    const group = await prisma.voiceInsightGroup.findFirst({
      where: { id: agent.insightGroupId, workspaceId: input.workspaceId },
    });
    if (group?.telnyxGroupId) {
      body.insight_settings = { insight_group_id: group.telnyxGroupId };
    }
  }
  if (mcpLinks.length) {
    body.mcp_servers = mcpLinks.map((m: { telnyxMcpId: string | null }) => ({
      id: m.telnyxMcpId,
    }));
  }
  if (obs?.configJson) {
    body.enabled_features = Array.isArray(
      (obs.configJson as { enabled_features?: unknown }).enabled_features,
    )
      ? (obs.configJson as { enabled_features: string[] }).enabled_features
      : undefined;
  }

  await ai.updateAssistant(input.telnyxAssistantId, body);
  return { ok: true, body };
}

// ── Versions / canary ───────────────────────────────────────────────────────

export async function syncRemoteVersions(workspaceId: string, agentId: string) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Agent has no Telnyx assistant id — publish first");
  const res = await telnyxOrMock(
    () => ai.listVersions(agent.telnyxAssistantId!),
    { data: [] },
  );
  const collection = Array.isArray(asData(res))
    ? (asData(res) as unknown[])
    : ((asData(res) as { data?: unknown[] })?.data ||
        (res as { data?: unknown[] }).data ||
        []) as unknown[];

  const prisma = getPrisma();
  const saved = [];
  for (const raw of collection) {
    const v = raw as Record<string, unknown>;
    const telnyxVersionId = String(v.id || v.version_id || "");
    if (!telnyxVersionId) continue;
    const row = await prisma.voiceRemoteAssistantVersion.upsert({
      where: {
        agentId_telnyxVersionId: { agentId, telnyxVersionId },
      },
      create: {
        workspaceId,
        agentId,
        telnyxAssistantId: agent.telnyxAssistantId,
        telnyxVersionId,
        label: (v.name as string) || null,
        isMain: Boolean(v.is_main || v.main),
        configJson: v as object,
        syncedAt: new Date(),
      },
      update: {
        label: (v.name as string) || null,
        isMain: Boolean(v.is_main || v.main),
        configJson: v as object,
        syncedAt: new Date(),
      },
    });
    saved.push(row);
  }
  return { versions: saved };
}

export async function promoteRemoteVersion(
  workspaceId: string,
  agentId: string,
  telnyxVersionId: string,
) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Missing telnyxAssistantId");
  const res = await ai.promoteVersion(agent.telnyxAssistantId, telnyxVersionId);
  await syncRemoteVersions(workspaceId, agentId);
  return { data: asData(res) };
}

export async function upsertCanary(
  workspaceId: string,
  agentId: string,
  rules: unknown[],
) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Missing telnyxAssistantId");
  const body = { rules };
  let remote: unknown;
  try {
    remote = await ai.getCanary(agent.telnyxAssistantId);
    remote = await ai.updateCanary(agent.telnyxAssistantId, body);
  } catch (err) {
    if (err instanceof TelnyxApiError && (err.status === 404 || err.status === 422)) {
      remote = await ai.createCanary(agent.telnyxAssistantId, body);
    } else throw err;
  }
  const prisma = getPrisma();
  const row = await prisma.voiceCanaryDeploy.create({
    data: {
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
      rulesJson: rules as object,
      status: "active",
      syncedAt: new Date(),
    },
  });
  return { row, remote: asData(remote) };
}

export async function deleteCanary(workspaceId: string, agentId: string) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Missing telnyxAssistantId");
  await ai.deleteCanary(agent.telnyxAssistantId);
  await getPrisma().voiceCanaryDeploy.updateMany({
    where: { workspaceId, agentId, status: "active" },
    data: { status: "deleted" },
  });
  return { ok: true };
}

// ── Tests ───────────────────────────────────────────────────────────────────

export async function syncAssistantTests(workspaceId: string) {
  const res = await telnyxOrMock(() => ai.listTests(), { data: [] });
  const list = ((res as { data?: unknown[] }).data || []) as Record<string, unknown>[];
  const prisma = getPrisma();
  const out = [];
  for (const t of list) {
    const telnyxTestId = String(t.id || "");
    if (!telnyxTestId) continue;
    const existing = await prisma.voiceAssistantTest.findFirst({
      where: { workspaceId, telnyxTestId },
    });
    const row = existing
      ? await prisma.voiceAssistantTest.update({
          where: { id: existing.id },
          data: {
            name: String(t.name || existing.name),
            description: (t.description as string) || null,
            suiteName: (t.destination || t.suite_name || t.suiteName || null) as string | null,
            configJson: t as object,
            status: "active",
          },
        })
      : await prisma.voiceAssistantTest.create({
          data: {
            workspaceId,
            telnyxTestId,
            name: String(t.name || "Untitled test"),
            description: (t.description as string) || null,
            suiteName: (t.suite_name as string) || null,
            configJson: t as object,
            status: "active",
          },
        });
    out.push(row);
  }
  return { tests: out };
}

export async function createAssistantTest(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const remote = await ai.createTest(body);
  const data = asData<Record<string, unknown>>(remote);
  const telnyxTestId = String(data.id || "");
  const row = await getPrisma().voiceAssistantTest.create({
    data: {
      workspaceId,
      agentId: (body.agentId as string) || null,
      telnyxTestId: telnyxTestId || `local-${Date.now()}`,
      name: String(body.name || data.name || "Test"),
      description: (body.description as string) || null,
      suiteName: (body.suite_name as string) || (body.suiteName as string) || null,
      configJson: { ...body, remote: data } as object,
      criteriaJson: (body.rubric || body.criteria || null) as object | undefined,
      status: "active",
    },
  });
  return { row, remote: data };
}

export async function runAssistantTest(workspaceId: string, testId: string) {
  const test = await getPrisma().voiceAssistantTest.findFirst({
    where: { id: testId, workspaceId },
  });
  if (!test) throw new Error("Test not found");
  const remote = await ai.triggerTestRun(test.telnyxTestId, {});
  const data = asData<Record<string, unknown>>(remote);
  const run = await getPrisma().voiceAssistantTestRun.create({
    data: {
      workspaceId,
      testId: test.id,
      suiteName: test.suiteName,
      telnyxRunId: (data.id as string) || null,
      status: "running",
      resultsJson: data as object,
      startedAt: new Date(),
    },
  });
  return { run, remote: data };
}

export async function runDefaultRegressionSuite(workspaceId: string, suiteName = "transovo-default") {
  const seeded = await seedDefaultRegressionSuite(workspaceId, suiteName);
  try {
    const remote = await ai.triggerSuiteRun(suiteName, {});
    return { ok: true, remote: asData(remote), seeded };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      suiteName,
      seeded,
      hint: "Suite tests were seeded locally; create/sync remote suite_name in Telnyx, then re-run",
    };
  }
}

// ── Memory / insights / MCP / transfers / widget ────────────────────────────

export async function saveMemoryConfig(
  workspaceId: string,
  agentId: string,
  input: {
    mode: string;
    retentionDays?: number;
    excludeFields?: string[];
    configJson?: Record<string, unknown>;
  },
) {
  await requireAgent(workspaceId, agentId);
  const prisma = getPrisma();
  const existing = await prisma.voiceMemoryConfig.findFirst({
    where: { workspaceId, agentId },
  });
  const data = {
    mode: input.mode || "conversation",
    retentionDays: input.retentionDays ?? 30,
    excludeFields: (input.excludeFields || []) as object,
    configJson: (input.configJson || {}) as object,
    telnyxPrivacyJson: {
      data_retention: input.mode !== "none",
    } as object,
  };
  const row = existing
    ? await prisma.voiceMemoryConfig.update({ where: { id: existing.id }, data })
    : await prisma.voiceMemoryConfig.create({
        data: { workspaceId, agentId, ...data },
      });
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { memoryConfigId: row.id },
  });
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (agent?.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    await enrichAssistantRemoteConfig({
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
    }).catch(() => undefined);
  }
  return row;
}

export async function upsertTransferDestination(
  workspaceId: string,
  input: {
    agentId?: string | null;
    name: string;
    kind: string;
    destination: string;
    businessHoursJson?: object;
    fallbackDestination?: string;
    voicemailOnFail?: boolean;
    returnToAiOnFail?: boolean;
    maxAttempts?: number;
    enabled?: boolean;
  },
) {
  const prisma = getPrisma();
  const agentId = input.agentId || null;
  const existing = await prisma.voiceTransferDestination.findFirst({
    where: { workspaceId, name: input.name, agentId: agentId || undefined },
  });
  const data = {
    kind: input.kind,
    destination: input.destination,
    businessHoursJson: (input.businessHoursJson || null) as object | undefined,
    fallbackDestination: input.fallbackDestination || null,
    voicemailOnFail: input.voicemailOnFail ?? true,
    returnToAiOnFail: input.returnToAiOnFail ?? true,
    maxAttempts: input.maxAttempts ?? 2,
    enabled: input.enabled ?? true,
  };
  if (existing) {
    return prisma.voiceTransferDestination.update({ where: { id: existing.id }, data });
  }
  return prisma.voiceTransferDestination.create({
    data: {
      workspaceId,
      agentId,
      name: input.name,
      ...data,
    },
  });
}

export async function registerMcpServer(
  workspaceId: string,
  input: { name: string; url: string; type?: string; approved?: boolean; configJson?: object },
) {
  if (!input.approved) {
    // Store locally pending review — do not push to Telnyx until approved.
    return getPrisma().voiceMcpServer.create({
      data: {
        workspaceId,
        name: input.name,
        url: input.url,
        type: input.type || "http",
        status: "pending_review",
        approved: false,
        configJson: (input.configJson || {}) as object,
      },
    });
  }
  const remote = await ai.createMcpServer({
    name: input.name,
    url: input.url,
    type: input.type || undefined,
    ...(input.configJson || {}),
  });
  const data = asData<Record<string, unknown>>(remote);
  return getPrisma().voiceMcpServer.create({
    data: {
      workspaceId,
      telnyxMcpId: String(data.id || ""),
      name: input.name,
      url: input.url,
      type: input.type || "http",
      status: "active",
      approved: true,
      configJson: { ...input.configJson, remote: data } as object,
    },
  });
}

export async function createScheduledEventSafe(
  workspaceId: string,
  agentId: string,
  input: {
    channel: "phone_call" | "sms_chat";
    endUserTarget: string;
    agentTarget: string;
    scheduledAt: string;
    text?: string;
    dynamicVariables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    consentRecorded?: boolean;
  },
) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Missing telnyxAssistantId");

  if (input.channel === "phone_call") {
    if (!agent.outboundAiEnabled) {
      throw new Error(
        "Outbound AI calls are disabled for this agent (outboundAiEnabled=false)",
      );
    }
    if (!input.consentRecorded) {
      throw new Error("Outbound AI call requires consentRecorded=true");
    }
  }

  // Quiet hours + opt-out / suppression for scheduled messaging/calls.
  const { getMessagingRuntimeSettings, isInQuietHours } = await import(
    "@/lib/messaging/messaging-settings"
  );
  const messaging = await getMessagingRuntimeSettings(workspaceId);
  if (isInQuietHours(messaging, new Date(input.scheduledAt))) {
    throw new Error("Scheduled event falls in quiet hours");
  }
  const suppressed = await getPrisma().suppression.findFirst({
    where: {
      workspaceId,
      OR: [
        { phone: input.endUserTarget },
        { suppressionKey: `${workspaceId}:p:${input.endUserTarget}` },
      ],
    },
  });
  if (suppressed) {
    throw new Error("End user is on suppression / opt-out list");
  }

  const body: Record<string, unknown> = {
    telnyx_conversation_channel: input.channel,
    telnyx_end_user_target: input.endUserTarget,
    telnyx_agent_target: input.agentTarget,
    scheduled_at_fixed_datetime: input.scheduledAt,
    conversation_metadata: input.metadata || {},
    dynamic_variables: input.dynamicVariables || {},
  };
  if (input.channel === "sms_chat") {
    if (!input.text?.trim()) throw new Error("SMS scheduled events require text");
    body.text = input.text;
  }

  const remote = await ai.createScheduledEvent(agent.telnyxAssistantId, body);
  const data = asData<Record<string, unknown>>(remote);
  const row = await getPrisma().voiceScheduledEvent.create({
    data: {
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
      telnyxEventId: (data.id as string) || null,
      channel: input.channel,
      endUserTarget: input.endUserTarget,
      agentTarget: input.agentTarget,
      scheduledAt: new Date(input.scheduledAt),
      text: input.text || null,
      dynamicVariables: (input.dynamicVariables || {}) as object,
      metadata: (input.metadata || {}) as object,
      status: "scheduled",
      consentRecorded: Boolean(input.consentRecorded),
      enabledByPolicy: input.channel === "sms_chat" || agent.outboundAiEnabled,
    },
  });
  return { row, remote: data };
}

export async function syncConversations(workspaceId: string, query?: Record<string, string>) {
  const remote = await telnyxOrMock(
    () => ai.listConversations(query),
    { data: [] },
  );
  const list = ((remote as { data?: unknown[] }).data || []) as Record<string, unknown>[];
  const prisma = getPrisma();
  const saved = [];
  for (const c of list) {
    const telnyxConversationId = String(c.id || "");
    if (!telnyxConversationId) continue;
    const existing = await prisma.voiceAiConversation.findFirst({
      where: { workspaceId, telnyxConversationId },
    });
    const row = existing
      ? await prisma.voiceAiConversation.update({
          where: { id: existing.id },
          data: {
            metadata: c as object,
            status: String(c.status || existing.status || "active"),
          },
        })
      : await prisma.voiceAiConversation.create({
          data: {
            workspaceId,
            telnyxConversationId,
            channel: (c.telnyx_conversation_channel as string) || null,
            metadata: c as object,
            status: String(c.status || "active"),
          },
        });
    saved.push(row);
    // Best-effort message sync into VoiceAiConversationMessage.
    try {
      const msgsRemote = await telnyxOrMock(
        () => ai.listConversationMessages(telnyxConversationId),
        { data: [] },
      );
      const msgs = ((msgsRemote as { data?: unknown[] }).data || []) as Record<
        string,
        unknown
      >[];
      for (const m of msgs.slice(0, 100)) {
        const telnyxMessageId = String(m.id || "");
        if (!telnyxMessageId) continue;
        const existingMsg = await prisma.voiceAiConversationMessage.findFirst({
          where: { conversationId: row.id, telnyxMessageId },
        });
        if (existingMsg) continue;
        await prisma.voiceAiConversationMessage.create({
          data: {
            workspaceId,
            conversationId: row.id,
            telnyxMessageId,
            role: String(m.role || m.sender || "unknown"),
            content: String(m.content || m.text || m.message || ""),
            metadata: m as object,
          },
        });
      }
    } catch {
      // message sync is best-effort
    }
  }
  return { conversations: saved };
}

export async function clearMemoryConfig(workspaceId: string, agentId: string) {
  const prisma = getPrisma();
  await requireAgent(workspaceId, agentId);
  const existing = await prisma.voiceMemoryConfig.findFirst({
    where: { workspaceId, agentId },
  });
  if (!existing) return { cleared: false };
  await prisma.voiceMemoryConfig.update({
    where: { id: existing.id },
    data: {
      mode: "none",
      excludeFields: [] as object,
      configJson: { clearedAt: new Date().toISOString() } as object,
      telnyxPrivacyJson: { data_retention: false } as object,
    },
  });
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (agent?.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    await enrichAssistantRemoteConfig({
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
    }).catch(() => undefined);
  }
  return { cleared: true };
}

const DEFAULT_INSIGHTS = [
  { name: "call_outcome", description: "Overall call outcome" },
  { name: "lead_qualified", description: "Whether the caller is a qualified lead" },
  { name: "appointment_booked", description: "Appointment was booked" },
  { name: "appointment_requested", description: "Appointment was requested" },
  { name: "human_transfer_requested", description: "Caller asked for a human" },
  { name: "transfer_success", description: "Transfer completed successfully" },
  { name: "follow_up_required", description: "Follow-up is required" },
  { name: "complaint", description: "Caller expressed a complaint" },
  { name: "urgency", description: "Urgency level of the request" },
  { name: "caller_sentiment", description: "Caller sentiment" },
  { name: "wrong_number_spam", description: "Wrong number or spam" },
  { name: "tool_failure", description: "A tool failed during the call" },
  { name: "caller_satisfaction", description: "Perceived caller satisfaction" },
  { name: "instruction_adherence", description: "Agent followed instructions" },
];

export async function seedDefaultInsights(workspaceId: string) {
  const prisma = getPrisma();
  const webhookUrl = `${getAppBaseUrl()}/api/telnyx/voice/insights`;
  let group = await prisma.voiceInsightGroup.findFirst({
    where: { workspaceId, name: "transovo-default-insights" },
  });
  if (!group) {
    let telnyxGroupId: string | null = null;
    if (ai.isTelnyxAiConfigured()) {
      try {
        const remote = await ai.createInsightGroup({
          name: "transovo-default-insights",
          webhook_url: webhookUrl,
        });
        const data = asData<Record<string, unknown>>(remote);
        telnyxGroupId = String(data.id || "") || null;
      } catch {
        // local-only group
      }
    }
    group = await prisma.voiceInsightGroup.create({
      data: {
        workspaceId,
        name: "transovo-default-insights",
        description: "Default Transovo insight group",
        webhookUrl,
        telnyxGroupId,
        status: "active",
      },
    });
  }
  const created = [];
  for (const insight of DEFAULT_INSIGHTS) {
    const existing = await prisma.voiceInsightDefinition.findFirst({
      where: { workspaceId, name: insight.name },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    let telnyxInsightId: string | null = null;
    if (ai.isTelnyxAiConfigured()) {
      try {
        const remote = await ai.createInsight({
          name: insight.name,
          instructions: insight.description,
        });
        const data = asData<Record<string, unknown>>(remote);
        telnyxInsightId = String(data.id || "") || null;
        if (telnyxInsightId && group.telnyxGroupId) {
          await ai
            .assignInsightToGroup(group.telnyxGroupId, telnyxInsightId)
            .catch(() => undefined);
        }
      } catch {
        // local row only
      }
    }
    const row = await prisma.voiceInsightDefinition.create({
      data: {
        workspaceId,
        telnyxInsightId,
        name: insight.name,
        description: insight.description,
        instructions: insight.description,
        status: "active",
      },
    });
    created.push(row);
  }
  return { group, insights: created };
}

export async function saveWidgetConfig(
  workspaceId: string,
  agentId: string,
  input: {
    domainAllowlist?: string[];
    rateLimitPerMin?: number;
    captchaEnabled?: boolean;
    testMode?: boolean;
    configJson?: object;
  },
) {
  await requireAgent(workspaceId, agentId);
  const prisma = getPrisma();
  const existing = await prisma.voiceWidgetConfig.findFirst({
    where: { workspaceId, agentId },
  });
  const data = {
    domainAllowlist: (input.domainAllowlist || []) as object,
    rateLimitPerMin: input.rateLimitPerMin ?? 30,
    captchaEnabled: input.captchaEnabled ?? true,
    testMode: input.testMode ?? true,
    configJson: (input.configJson || {}) as object,
    status: "active",
  };
  const row = existing
    ? await prisma.voiceWidgetConfig.update({ where: { id: existing.id }, data })
    : await prisma.voiceWidgetConfig.create({
        data: { workspaceId, agentId, ...data },
      });
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { widgetEnabled: true },
  });
  return row;
}

export async function upsertConcurrency(
  workspaceId: string,
  input: Partial<{
    maxInboundAi: number;
    maxOutboundAi: number;
    maxTransferLegs: number;
    softAlertPct: number;
    hardSpendLimitCents: number | null;
  }>,
) {
  return getPrisma().voiceConcurrencyAllocation.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      maxInboundAi: input.maxInboundAi ?? 5,
      maxOutboundAi: input.maxOutboundAi ?? 0,
      maxTransferLegs: input.maxTransferLegs ?? 10,
      softAlertPct: input.softAlertPct ?? 80,
      hardSpendLimitCents: input.hardSpendLimitCents ?? null,
    },
    update: {
      ...(input.maxInboundAi != null ? { maxInboundAi: input.maxInboundAi } : {}),
      ...(input.maxOutboundAi != null ? { maxOutboundAi: input.maxOutboundAi } : {}),
      ...(input.maxTransferLegs != null ? { maxTransferLegs: input.maxTransferLegs } : {}),
      ...(input.softAlertPct != null ? { softAlertPct: input.softAlertPct } : {}),
      ...(input.hardSpendLimitCents !== undefined
        ? { hardSpendLimitCents: input.hardSpendLimitCents }
        : {}),
    },
  });
}

export async function setAgentFlags(
  workspaceId: string,
  agentId: string,
  flags: Partial<{
    emergencyDisabled: boolean;
    multiPartyEnabled: boolean;
    outboundAiEnabled: boolean;
    widgetEnabled: boolean;
  }>,
) {
  // Do not use requireAgent — clearing emergency must work while disabled.
  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  return getPrisma().voiceAgent.update({
    where: { id: agentId },
    data: flags,
  });
}

export async function approveMcpServer(workspaceId: string, mcpId: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceMcpServer.findFirst({
    where: { id: mcpId, workspaceId },
  });
  if (!row) throw new Error("MCP server not found");
  if (row.approved && row.telnyxMcpId) return row;
  const remote = await ai.createMcpServer({
    name: row.name,
    url: row.url,
    type: row.type || undefined,
    ...((row.configJson as object) || {}),
  });
  const data = asData<Record<string, unknown>>(remote);
  return prisma.voiceMcpServer.update({
    where: { id: row.id },
    data: {
      approved: true,
      status: "active",
      telnyxMcpId: String(data.id || row.telnyxMcpId || ""),
      configJson: { ...(row.configJson as object), remote: data } as object,
    },
  });
}

export async function rejectMcpServer(workspaceId: string, mcpId: string) {
  const row = await getPrisma().voiceMcpServer.findFirst({
    where: { id: mcpId, workspaceId },
  });
  if (!row) throw new Error("MCP server not found");
  if (row.telnyxMcpId && ai.isTelnyxAiConfigured()) {
    await ai.deleteMcpServer(row.telnyxMcpId).catch(() => undefined);
  }
  return getPrisma().voiceMcpServer.update({
    where: { id: row.id },
    data: { approved: false, status: "rejected", telnyxMcpId: null },
  });
}

export async function saveObservabilityConfig(
  workspaceId: string,
  agentId: string,
  input: {
    langfuseEnabled?: boolean;
    enabledFeatures?: string[];
    configJson?: Record<string, unknown>;
  },
) {
  await requireAgent(workspaceId, agentId);
  const prisma = getPrisma();
  const existing = await prisma.voiceObservabilityConfig.findFirst({
    where: { workspaceId, agentId },
  });
  const configJson = {
    ...(input.configJson || {}),
    enabled_features: input.enabledFeatures ||
      (input.configJson?.enabled_features as string[]) ||
      [],
    langfuseEnabled: Boolean(input.langfuseEnabled),
  };
  const row = existing
    ? await prisma.voiceObservabilityConfig.update({
        where: { id: existing.id },
        data: {
          configJson: configJson as object,
          langfuseEnabled: Boolean(input.langfuseEnabled),
        },
      })
    : await prisma.voiceObservabilityConfig.create({
        data: {
          workspaceId,
          agentId,
          configJson: configJson as object,
          langfuseEnabled: Boolean(input.langfuseEnabled),
        },
      });
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { observabilityConfigId: row.id },
  });
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (agent?.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    await enrichAssistantRemoteConfig({
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
    }).catch(() => undefined);
  }
  return row;
}

export async function syncInsightCatalog(workspaceId: string) {
  const [insightsRemote, groupsRemote] = await Promise.all([
    telnyxOrMock(() => ai.listInsights(), { data: [] }),
    telnyxOrMock(() => ai.listInsightGroups(), { data: [] }),
  ]);
  const insights = ((insightsRemote as { data?: unknown[] }).data ||
    []) as Record<string, unknown>[];
  const groups = ((groupsRemote as { data?: unknown[] }).data ||
    []) as Record<string, unknown>[];
  const prisma = getPrisma();
  const savedInsights = [];
  for (const i of insights) {
    const telnyxInsightId = String(i.id || "");
    if (!telnyxInsightId) continue;
    const existing = await prisma.voiceInsightDefinition.findFirst({
      where: { workspaceId, telnyxInsightId },
    });
    const row = existing
      ? await prisma.voiceInsightDefinition.update({
          where: { id: existing.id },
          data: {
            name: String(i.name || existing.name),
            description: (i.description as string) || null,
            instructions: (i.instructions as string) || null,
            jsonSchema: (i.json_schema as object) || existing.jsonSchema || undefined,
            status: "active",
          },
        })
      : await prisma.voiceInsightDefinition.create({
          data: {
            workspaceId,
            telnyxInsightId,
            name: String(i.name || "Insight"),
            description: (i.description as string) || null,
            instructions: (i.instructions as string) || null,
            jsonSchema: (i.json_schema as object) || undefined,
            status: "active",
          },
        });
    savedInsights.push(row);
  }
  const savedGroups = [];
  for (const g of groups) {
    const telnyxGroupId = String(g.id || "");
    if (!telnyxGroupId) continue;
    const existing = await prisma.voiceInsightGroup.findFirst({
      where: { workspaceId, telnyxGroupId },
    });
    const row = existing
      ? await prisma.voiceInsightGroup.update({
          where: { id: existing.id },
          data: {
            name: String(g.name || existing.name),
            description: (g.description as string) || null,
            webhookUrl: (g.webhook_url as string) || existing.webhookUrl,
            status: "active",
          },
        })
      : await prisma.voiceInsightGroup.create({
          data: {
            workspaceId,
            telnyxGroupId,
            name: String(g.name || "Insight group"),
            description: (g.description as string) || null,
            webhookUrl: (g.webhook_url as string) || null,
            status: "active",
          },
        });
    savedGroups.push(row);
  }
  return { insights: savedInsights, groups: savedGroups };
}

export async function attachInsightGroupToAgent(
  workspaceId: string,
  agentId: string,
  insightGroupId: string,
) {
  await requireAgent(workspaceId, agentId);
  const group = await getPrisma().voiceInsightGroup.findFirst({
    where: { id: insightGroupId, workspaceId },
  });
  if (!group) throw new Error("Insight group not found");
  const agent = await getPrisma().voiceAgent.update({
    where: { id: agentId },
    data: { insightGroupId: group.id },
  });
  if (agent.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    await enrichAssistantRemoteConfig({
      workspaceId,
      agentId,
      telnyxAssistantId: agent.telnyxAssistantId,
    });
  }
  return { agent, group };
}

export async function cancelScheduledEvent(
  workspaceId: string,
  eventId: string,
) {
  const row = await getPrisma().voiceScheduledEvent.findFirst({
    where: { id: eventId, workspaceId },
  });
  if (!row) throw new Error("Scheduled event not found");
  if (row.telnyxEventId && row.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    await ai
      .deleteScheduledEvent(row.telnyxAssistantId, row.telnyxEventId)
      .catch(() => undefined);
  }
  return getPrisma().voiceScheduledEvent.update({
    where: { id: row.id },
    data: { status: "cancelled" },
  });
}

export async function syncScheduledEvents(workspaceId: string, agentId: string) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Missing telnyxAssistantId");
  const remote = await telnyxOrMock(
    () => ai.listScheduledEvents(agent.telnyxAssistantId!),
    { data: [] },
  );
  const list = ((remote as { data?: unknown[] }).data || []) as Record<string, unknown>[];
  const prisma = getPrisma();
  const saved = [];
  for (const e of list) {
    const telnyxEventId = String(e.id || "");
    if (!telnyxEventId) continue;
    const existing = await prisma.voiceScheduledEvent.findFirst({
      where: { workspaceId, telnyxEventId },
    });
    const scheduledAt = e.scheduled_at_fixed_datetime
      ? new Date(String(e.scheduled_at_fixed_datetime))
      : new Date();
    const row = existing
      ? await prisma.voiceScheduledEvent.update({
          where: { id: existing.id },
          data: {
            status: String(e.status || existing.status),
            metadata: e as object,
            scheduledAt,
          },
        })
      : await prisma.voiceScheduledEvent.create({
          data: {
            workspaceId,
            agentId,
            telnyxAssistantId: agent.telnyxAssistantId,
            telnyxEventId,
            channel: String(e.telnyx_conversation_channel || "sms_chat"),
            endUserTarget: String(e.telnyx_end_user_target || ""),
            agentTarget: String(e.telnyx_agent_target || ""),
            scheduledAt,
            text: (e.text as string) || null,
            metadata: e as object,
            status: String(e.status || "scheduled"),
            consentRecorded: false,
            enabledByPolicy: true,
          },
        });
    saved.push(row);
  }
  return { events: saved };
}

const DEFAULT_SUITE_TESTS = [
  {
    name: "transovo-greeting",
    description: "Assistant greets the caller and states purpose",
    rubric: { criteria: [{ name: "greeting", description: "Agent greets the caller", weight: 1 }] },
  },
  {
    name: "transovo-business-hours",
    description: "Assistant correctly describes business hours when asked",
    rubric: { criteria: [{ name: "hours", description: "Agent states hours accurately or looks them up", weight: 1 }] },
  },
  {
    name: "transovo-service-area",
    description: "Assistant refuses or redirects out-of-area requests",
    rubric: { criteria: [{ name: "service_area", description: "Agent handles out-of-area politely", weight: 1 }] },
  },
  {
    name: "transovo-transfer",
    description: "Assistant offers transfer to a human when asked",
    rubric: { criteria: [{ name: "transfer_offer", description: "Agent can transfer or offer a human", weight: 1 }] },
  },
  {
    name: "transovo-booking",
    description: "Assistant can discuss booking an appointment",
    rubric: { criteria: [{ name: "booking", description: "Agent discusses scheduling / booking", weight: 1 }] },
  },
  {
    name: "transovo-booking-failure",
    description: "Assistant handles unavailable slots without claiming success",
    rubric: { criteria: [{ name: "no_false_book", description: "Agent does not claim booked on failure", weight: 1 }] },
  },
  {
    name: "transovo-crm-lookup",
    description: "Assistant looks up caller context before inventing facts",
    rubric: { criteria: [{ name: "crm_lookup", description: "Agent uses lookup tools when relevant", weight: 1 }] },
  },
  {
    name: "transovo-unsupported",
    description: "Assistant refuses unsupported questions instead of hallucinating",
    rubric: { criteria: [{ name: "refusal", description: "Agent admits limits / offers transfer", weight: 1 }] },
  },
  {
    name: "transovo-emergency",
    description: "Assistant escalates emergency or life-safety requests",
    rubric: { criteria: [{ name: "emergency", description: "Agent escalates appropriately", weight: 1 }] },
  },
  {
    name: "transovo-request-human",
    description: "Caller asks for a human — assistant transfers or offers callback",
    rubric: { criteria: [{ name: "human", description: "Agent honors human request", weight: 1 }] },
  },
  {
    name: "transovo-wrong-pricing",
    description: "Assistant does not invent prices",
    rubric: { criteria: [{ name: "pricing", description: "Agent refuses unknown pricing or uses KB", weight: 1 }] },
  },
  {
    name: "transovo-call-ending",
    description: "Assistant ends the call politely when conversation is done",
    rubric: { criteria: [{ name: "end_call", description: "Agent closes cleanly", weight: 1 }] },
  },
];

/** Seed local + remote default regression suite tests when missing. */
export async function seedDefaultRegressionSuite(
  workspaceId: string,
  suiteName = "transovo-default",
) {
  const prisma = getPrisma();
  await prisma.voiceTestSuite.upsert({
    where: { workspaceId_name: { workspaceId, name: suiteName } },
    create: {
      workspaceId,
      name: suiteName,
      description: "Default Transovo regression suite",
      status: "active",
    },
    update: { status: "active" },
  });

  const created = [];
  for (const t of DEFAULT_SUITE_TESTS) {
    const existing = await prisma.voiceAssistantTest.findFirst({
      where: { workspaceId, name: t.name, suiteName },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    if (!ai.isTelnyxAiConfigured()) {
      const row = await prisma.voiceAssistantTest.create({
        data: {
          workspaceId,
          telnyxTestId: `local-${t.name}`,
          name: t.name,
          description: t.description,
          suiteName,
          criteriaJson: t.rubric as object,
          configJson: t as object,
          status: "active",
        },
      });
      created.push(row);
      continue;
    }
    try {
      const remote = await ai.createTest({
        name: t.name,
        description: t.description,
        suite_name: suiteName,
        destination: suiteName,
        rubric: t.rubric,
      });
      const data = asData<Record<string, unknown>>(remote);
      const row = await prisma.voiceAssistantTest.create({
        data: {
          workspaceId,
          telnyxTestId: String(data.id || `local-${t.name}`),
          name: t.name,
          description: t.description,
          suiteName,
          criteriaJson: t.rubric as object,
          configJson: { ...t, remote: data } as object,
          status: "active",
        },
      });
      created.push(row);
    } catch (err) {
      const row = await prisma.voiceAssistantTest.create({
        data: {
          workspaceId,
          telnyxTestId: `local-${t.name}-${Date.now()}`,
          name: t.name,
          description: t.description,
          suiteName,
          criteriaJson: t.rubric as object,
          configJson: {
            ...t,
            seedError: err instanceof Error ? err.message : String(err),
          } as object,
          status: "pending_remote",
        },
      });
      created.push(row);
    }
  }
  return { suiteName, tests: created };
}

export async function pollTestRun(workspaceId: string, runId: string) {
  const prisma = getPrisma();
  const run = await prisma.voiceAssistantTestRun.findFirst({
    where: { id: runId, workspaceId },
    include: { test: true },
  });
  if (!run) throw new Error("Test run not found");
  if (!run.telnyxRunId || !run.test?.telnyxTestId || !ai.isTelnyxAiConfigured()) {
    return run;
  }
  const remote = await ai.getTestRun(run.test.telnyxTestId, run.telnyxRunId);
  const data = asData<Record<string, unknown>>(remote);
  const status = String(data.status || run.status);
  return prisma.voiceAssistantTestRun.update({
    where: { id: run.id },
    data: {
      status,
      resultsJson: data as object,
      completedAt:
        status === "completed" || status === "failed" || status === "passed"
          ? new Date()
          : run.completedAt,
    },
  });
}

export async function ingestInsightWebhook(input: {
  workspaceId?: string | null;
  payload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const conversationId = String(
    input.payload.conversation_id ||
      input.payload.telnyx_conversation_id ||
      (input.payload.data as Record<string, unknown> | undefined)?.conversation_id ||
      "",
  );
  const insightResults =
    (input.payload.insights as unknown[]) ||
    (input.payload.results as unknown[]) ||
    ((input.payload.data as Record<string, unknown> | undefined)?.insights as unknown[]) ||
    [];

  let conv = conversationId
    ? await prisma.voiceAiConversation.findFirst({
        where: {
          telnyxConversationId: conversationId,
          ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        },
      })
    : null;

  if (!conv && input.workspaceId) {
    conv = await prisma.voiceAiConversation.create({
      data: {
        workspaceId: input.workspaceId,
        telnyxConversationId: conversationId || `insight-${Date.now()}`,
        metadata: input.payload as object,
        status: "insight_received",
      },
    });
  }

  if (conv) {
    await prisma.voiceAiConversation.update({
      where: { id: conv.id },
      data: {
        metadata: {
          ...((conv.metadata as object) || {}),
          lastInsightWebhook: input.payload,
          insightResults,
        } as object,
        status: "insights_ready",
      },
    });
  }

  return { conversationId, stored: Boolean(conv), resultCount: insightResults.length };
}

export async function recordFailureDiagnostic(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  category: string;
  code?: string;
  message: string;
  detailsJson?: object;
}) {
  return getPrisma().voiceFailureDiagnostic.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId || null,
      callId: input.callId || null,
      category: input.category,
      code: input.code || null,
      message: input.message.slice(0, 2000),
      detailsJson: (input.detailsJson || {}) as object,
    },
  });
}

export async function cloneAgentFull(workspaceId: string, agentId: string) {
  const { duplicateVoiceAgent } = await import("../agent-service");
  const copy = await duplicateVoiceAgent(workspaceId, agentId);
  const agent = await requireAgent(workspaceId, agentId);
  if (agent.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    try {
      const remote = await ai.cloneAssistant(agent.telnyxAssistantId, {
        name: copy.name,
      });
      const data = asData<Record<string, unknown>>(remote);
      if (data.id) {
        await getPrisma().voiceAgent.update({
          where: { id: copy.id },
          data: { telnyxAssistantId: String(data.id) },
        });
      }
    } catch {
      // local clone still succeeds
    }
  }
  return copy;
}

export async function chatPreview(
  workspaceId: string,
  agentId: string,
  message: string,
) {
  const agent = await requireAgent(workspaceId, agentId);
  if (!agent.telnyxAssistantId) throw new Error("Publish agent to Telnyx before chat preview");
  return ai.chatAssistant(agent.telnyxAssistantId, {
    messages: [{ role: "user", content: message }],
  });
}
