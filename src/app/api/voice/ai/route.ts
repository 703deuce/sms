import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import * as platform from "@/lib/voice/platform/ai-platform";
import * as ai from "@/lib/voice/telnyx/ai-client";
import { capabilityRegistrySnapshot } from "@/lib/voice/telnyx/capability-registry";

/**
 * Unified AI Voice platform API.
 * POST { action, agentId?, ...params }
 */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "diagnostics";
    if (view === "registry") {
      return NextResponse.json({ data: capabilityRegistrySnapshot() });
    }
    if (view === "diagnostics") {
      const data = await platform.getAiPlatformDiagnostics(auth.workspaceId);
      return NextResponse.json({ data });
    }
    if (view === "destinations") {
      const agentId = url.searchParams.get("agentId");
      const rows = await getPrisma().voiceTransferDestination.findMany({
        where: {
          workspaceId: auth.workspaceId,
          ...(agentId ? { agentId } : {}),
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "mcp") {
      const rows = await getPrisma().voiceMcpServer.findMany({
        where: { workspaceId: auth.workspaceId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "conversations") {
      const rows = await getPrisma().voiceAiConversation.findMany({
        where: { workspaceId: auth.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "tests") {
      const rows = await getPrisma().voiceAssistantTest.findMany({
        where: { workspaceId: auth.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "integrations") {
      if (!ai.isTelnyxAiConfigured()) {
        return NextResponse.json({ data: { available: [], connections: [] } });
      }
      const [available, connections] = await Promise.all([
        ai.listIntegrations().catch(() => ({ data: [] })),
        ai.listIntegrationConnections().catch(() => ({ data: [] })),
      ]);
      return NextResponse.json({ data: { available, connections } });
    }
    if (view === "versions") {
      const agentId = url.searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ error: "agentId required" }, { status: 400 });
      }
      const rows = await getPrisma().voiceRemoteAssistantVersion.findMany({
        where: { workspaceId: auth.workspaceId, agentId },
        orderBy: { syncedAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "canary") {
      const agentId = url.searchParams.get("agentId");
      const rows = await getPrisma().voiceCanaryDeploy.findMany({
        where: {
          workspaceId: auth.workspaceId,
          ...(agentId ? { agentId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "memory") {
      const agentId = url.searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ error: "agentId required" }, { status: 400 });
      }
      const row = await getPrisma().voiceMemoryConfig.findFirst({
        where: { workspaceId: auth.workspaceId, agentId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ data: row });
    }
    if (view === "scheduled") {
      const agentId = url.searchParams.get("agentId");
      const rows = await getPrisma().voiceScheduledEvent.findMany({
        where: {
          workspaceId: auth.workspaceId,
          ...(agentId ? { agentId } : {}),
        },
        orderBy: { scheduledAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "insights") {
      const [definitions, groups] = await Promise.all([
        getPrisma().voiceInsightDefinition.findMany({
          where: { workspaceId: auth.workspaceId },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
        getPrisma().voiceInsightGroup.findMany({
          where: { workspaceId: auth.workspaceId },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ]);
      return NextResponse.json({ data: { definitions, groups } });
    }
    if (view === "widget") {
      const agentId = url.searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ error: "agentId required" }, { status: 400 });
      }
      const row = await getPrisma().voiceWidgetConfig.findFirst({
        where: { workspaceId: auth.workspaceId, agentId },
      });
      return NextResponse.json({ data: row });
    }
    if (view === "concurrency") {
      const row = await getPrisma().voiceConcurrencyAllocation.findUnique({
        where: { workspaceId: auth.workspaceId },
      });
      return NextResponse.json({
        data: row || {
          maxInboundAi: 5,
          maxOutboundAi: 0,
          maxTransferLegs: 10,
          softAlertPct: 80,
          hardSpendLimitCents: null,
        },
      });
    }
    if (view === "observability") {
      const agentId = url.searchParams.get("agentId");
      const rows = await getPrisma().voiceObservabilityConfig.findMany({
        where: {
          workspaceId: auth.workspaceId,
          ...(agentId ? { agentId } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "diagnostics_failures") {
      const rows = await getPrisma().voiceFailureDiagnostic.findMany({
        where: { workspaceId: auth.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: rows });
    }
    if (view === "agent") {
      const agentId = url.searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ error: "agentId required" }, { status: 400 });
      }
      const agent = await getPrisma().voiceAgent.findFirst({
        where: { id: agentId, workspaceId: auth.workspaceId },
        select: {
          id: true,
          name: true,
          status: true,
          telnyxAssistantId: true,
          emergencyDisabled: true,
          multiPartyEnabled: true,
          outboundAiEnabled: true,
          widgetEnabled: true,
          memoryConfigId: true,
          insightGroupId: true,
          observabilityConfigId: true,
        },
      });
      return NextResponse.json({ data: agent });
    }
    return NextResponse.json({ error: `Unknown view ${view}` }, { status: 400 });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const workspaceId = auth.workspaceId;

    switch (action) {
      case "diagnostics":
        return NextResponse.json({
          data: await platform.getAiPlatformDiagnostics(workspaceId),
        });
      case "enrich_remote": {
        const agentRow = await getPrisma().voiceAgent.findFirst({
          where: { id: agentId, workspaceId },
        });
        const telnyxAssistantId =
          String(body.telnyxAssistantId || "") || agentRow?.telnyxAssistantId || "";
        if (!telnyxAssistantId) {
          return NextResponse.json(
            { error: "Publish agent to Telnyx before enrich" },
            { status: 400 },
          );
        }
        return NextResponse.json({
          data: await platform.enrichAssistantRemoteConfig({
            workspaceId,
            agentId,
            telnyxAssistantId,
          }),
        });
      }
      case "fetch_live_assistant": {
        const agentRow = await getPrisma().voiceAgent.findFirst({
          where: { id: agentId, workspaceId },
        });
        const telnyxAssistantId =
          String(body.telnyxAssistantId || "") || agentRow?.telnyxAssistantId || "";
        if (!telnyxAssistantId) {
          return NextResponse.json(
            { error: "No Telnyx assistant id — build the agent first" },
            { status: 400 },
          );
        }
        const remote = await ai.getAssistant(telnyxAssistantId);
        const data = (remote as { data?: Record<string, unknown> }).data || remote;
        const tools = Array.isArray((data as { tools?: unknown[] }).tools)
          ? ((data as { tools: unknown[] }).tools as Array<Record<string, unknown>>)
          : [];
        return NextResponse.json({
          data: {
            telnyxAssistantId,
            model: (data as { model?: string }).model,
            name: (data as { name?: string }).name,
            toolCount: tools.length,
            tools: tools.map((t) => {
              const webhook = t.webhook as { name?: string; url?: string; timeout_ms?: number } | undefined;
              const transfer = t.transfer as { targets?: unknown } | undefined;
              return {
                type: t.type,
                name:
                  webhook?.name ||
                  (t.type === "transfer" ? "transfer" : undefined) ||
                  (t.type === "hangup" ? "hangup" : undefined) ||
                  (t.type === "handoff" ? "handoff" : String(t.type || "unknown")),
                transferTargets: transfer?.targets,
                hangup: t.hangup,
                webhookUrl: webhook?.url,
                timeout_ms: webhook?.timeout_ms,
              };
            }),
            rawTools: tools,
          },
        });
      }
      case "sync_versions":
        return NextResponse.json({
          data: await platform.syncRemoteVersions(workspaceId, agentId),
        });
      case "promote_version":
        return NextResponse.json({
          data: await platform.promoteRemoteVersion(
            workspaceId,
            agentId,
            String(body.telnyxVersionId || ""),
          ),
        });
      case "upsert_canary":
        return NextResponse.json({
          data: await platform.upsertCanary(
            workspaceId,
            agentId,
            Array.isArray(body.rules) ? body.rules : [],
          ),
        });
      case "delete_canary":
        return NextResponse.json({
          data: await platform.deleteCanary(workspaceId, agentId),
        });
      case "sync_tests":
        return NextResponse.json({
          data: await platform.syncAssistantTests(workspaceId),
        });
      case "create_test":
        return NextResponse.json({
          data: await platform.createAssistantTest(workspaceId, body),
        });
      case "run_test":
        return NextResponse.json({
          data: await platform.runAssistantTest(workspaceId, String(body.testId || "")),
        });
      case "run_suite":
        return NextResponse.json({
          data: await platform.runDefaultRegressionSuite(
            workspaceId,
            String(body.suiteName || "transovo-default"),
          ),
        });
      case "save_memory":
        return NextResponse.json({
          data: await platform.saveMemoryConfig(workspaceId, agentId, {
            mode: String(body.mode || "conversation"),
            retentionDays: body.retentionDays != null ? Number(body.retentionDays) : undefined,
            excludeFields: Array.isArray(body.excludeFields)
              ? body.excludeFields.map(String)
              : undefined,
            configJson: (body.configJson as Record<string, unknown>) || undefined,
          }),
        });
      case "upsert_destination":
        return NextResponse.json({
          data: await platform.upsertTransferDestination(workspaceId, {
            agentId: agentId || null,
            name: String(body.name || ""),
            kind: String(body.kind || "external"),
            destination: String(body.destination || ""),
            businessHoursJson: body.businessHoursJson as object | undefined,
            fallbackDestination: body.fallbackDestination
              ? String(body.fallbackDestination)
              : undefined,
            voicemailOnFail: body.voicemailOnFail as boolean | undefined,
            returnToAiOnFail: body.returnToAiOnFail as boolean | undefined,
            maxAttempts: body.maxAttempts != null ? Number(body.maxAttempts) : undefined,
            enabled: body.enabled as boolean | undefined,
          }),
        });
      case "register_mcp":
        return NextResponse.json({
          data: await platform.registerMcpServer(workspaceId, {
            name: String(body.name || ""),
            url: String(body.url || ""),
            type: body.type ? String(body.type) : undefined,
            approved: Boolean(body.approved),
            configJson: body.configJson as object | undefined,
          }),
        });
      case "schedule_event":
        return NextResponse.json({
          data: await platform.createScheduledEventSafe(workspaceId, agentId, {
            channel: body.channel === "phone_call" ? "phone_call" : "sms_chat",
            endUserTarget: String(body.endUserTarget || ""),
            agentTarget: String(body.agentTarget || ""),
            scheduledAt: String(body.scheduledAt || ""),
            text: body.text ? String(body.text) : undefined,
            dynamicVariables: (body.dynamicVariables as Record<string, unknown>) || undefined,
            metadata: (body.metadata as Record<string, unknown>) || undefined,
            consentRecorded: Boolean(body.consentRecorded),
          }),
        });
      case "sync_conversations":
        return NextResponse.json({
          data: await platform.syncConversations(
            workspaceId,
            (body.query as Record<string, string>) || undefined,
          ),
        });
      case "save_widget":
        return NextResponse.json({
          data: await platform.saveWidgetConfig(workspaceId, agentId, {
            domainAllowlist: Array.isArray(body.domainAllowlist)
              ? body.domainAllowlist.map(String)
              : undefined,
            rateLimitPerMin:
              body.rateLimitPerMin != null ? Number(body.rateLimitPerMin) : undefined,
            captchaEnabled: body.captchaEnabled as boolean | undefined,
            testMode: body.testMode as boolean | undefined,
            configJson: body.configJson as object | undefined,
          }),
        });
      case "upsert_concurrency":
        return NextResponse.json({
          data: await platform.upsertConcurrency(workspaceId, {
            maxInboundAi: body.maxInboundAi != null ? Number(body.maxInboundAi) : undefined,
            maxOutboundAi: body.maxOutboundAi != null ? Number(body.maxOutboundAi) : undefined,
            maxTransferLegs:
              body.maxTransferLegs != null ? Number(body.maxTransferLegs) : undefined,
            softAlertPct: body.softAlertPct != null ? Number(body.softAlertPct) : undefined,
            hardSpendLimitCents:
              body.hardSpendLimitCents === null
                ? null
                : body.hardSpendLimitCents != null
                  ? Number(body.hardSpendLimitCents)
                  : undefined,
          }),
        });
      case "set_flags":
        return NextResponse.json({
          data: await platform.setAgentFlags(workspaceId, agentId, {
            emergencyDisabled: body.emergencyDisabled as boolean | undefined,
            multiPartyEnabled: body.multiPartyEnabled as boolean | undefined,
            outboundAiEnabled: body.outboundAiEnabled as boolean | undefined,
            widgetEnabled: body.widgetEnabled as boolean | undefined,
          }),
        });
      case "clone_agent":
        return NextResponse.json({
          data: await platform.cloneAgentFull(workspaceId, agentId),
        });
      case "chat_preview":
        return NextResponse.json({
          data: await platform.chatPreview(
            workspaceId,
            agentId,
            String(body.message || ""),
            body.conversationId ? String(body.conversationId) : undefined,
          ),
        });
      case "send_dtmf": {
        const callControlId = String(body.callControlId || "");
        const digits = String(body.digits || "");
        if (!callControlId || !digits) {
          return NextResponse.json(
            { error: "callControlId and digits required" },
            { status: 400 },
          );
        }
        // Validate digits — no arbitrary unrestricted sequences from untrusted UI without allowlist.
        if (!/^[0-9A-D*#wW,]{1,32}$/.test(digits)) {
          return NextResponse.json({ error: "Invalid DTMF sequence" }, { status: 400 });
        }
        const data = await ai.sendDtmf(callControlId, digits);
        return NextResponse.json({ data });
      }
      case "create_insight": {
        const remote = await ai.createInsight(body as Record<string, unknown>);
        const data = (remote as { data?: Record<string, unknown> }).data || remote;
        const row = await getPrisma().voiceInsightDefinition.create({
          data: {
            workspaceId,
            telnyxInsightId: String((data as { id?: string }).id || ""),
            name: String(body.name || "Insight"),
            description: body.description ? String(body.description) : null,
            instructions: body.instructions ? String(body.instructions) : null,
            jsonSchema: (body.json_schema || body.jsonSchema || null) as object | undefined,
            status: "active",
          },
        });
        return NextResponse.json({ data: { row, remote: data } });
      }
      case "create_insight_group": {
        const remote = await ai.createInsightGroup(body as Record<string, unknown>);
        const data = (remote as { data?: Record<string, unknown> }).data || remote;
        const row = await getPrisma().voiceInsightGroup.create({
          data: {
            workspaceId,
            telnyxGroupId: String((data as { id?: string }).id || ""),
            name: String(body.name || "Insight group"),
            description: body.description ? String(body.description) : null,
            webhookUrl: body.webhook_url
              ? String(body.webhook_url)
              : body.webhookUrl
                ? String(body.webhookUrl)
                : null,
            status: "active",
          },
        });
        return NextResponse.json({ data: { row, remote: data } });
      }
      case "assign_tags": {
        const agent = await getPrisma().voiceAgent.findFirst({
          where: { id: agentId, workspaceId },
        });
        if (!agent?.telnyxAssistantId) {
          return NextResponse.json({ error: "Agent missing Telnyx id" }, { status: 400 });
        }
        const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
        const remote = await ai.assignTags(agent.telnyxAssistantId, { tags });
        for (const tag of tags) {
          await getPrisma().voiceAssistantTag.upsert({
            where: { agentId_tag: { agentId, tag } },
            create: { workspaceId, agentId, tag, telnyxSynced: true },
            update: { telnyxSynced: true },
          });
        }
        return NextResponse.json({ data: { tags, remote } });
      }
      case "approve_mcp":
        return NextResponse.json({
          data: await platform.approveMcpServer(workspaceId, String(body.mcpId || "")),
        });
      case "reject_mcp":
        return NextResponse.json({
          data: await platform.rejectMcpServer(workspaceId, String(body.mcpId || "")),
        });
      case "save_observability":
        return NextResponse.json({
          data: await platform.saveObservabilityConfig(workspaceId, agentId, {
            langfuseEnabled: body.langfuseEnabled as boolean | undefined,
            enabledFeatures: Array.isArray(body.enabledFeatures)
              ? body.enabledFeatures.map(String)
              : undefined,
            configJson: (body.configJson as Record<string, unknown>) || undefined,
          }),
        });
      case "sync_insights":
        return NextResponse.json({
          data: await platform.syncInsightCatalog(workspaceId),
        });
      case "attach_insight_group":
        return NextResponse.json({
          data: await platform.attachInsightGroupToAgent(
            workspaceId,
            agentId,
            String(body.insightGroupId || ""),
          ),
        });
      case "sync_scheduled":
        return NextResponse.json({
          data: await platform.syncScheduledEvents(workspaceId, agentId),
        });
      case "cancel_scheduled":
        return NextResponse.json({
          data: await platform.cancelScheduledEvent(
            workspaceId,
            String(body.eventId || ""),
          ),
        });
      case "seed_suite":
        return NextResponse.json({
          data: await platform.seedDefaultRegressionSuite(
            workspaceId,
            String(body.suiteName || "transovo-default"),
          ),
        });
      case "poll_test_run":
        return NextResponse.json({
          data: await platform.pollTestRun(workspaceId, String(body.runId || "")),
        });
      case "clear_memory":
        return NextResponse.json({
          data: await platform.clearMemoryConfig(workspaceId, agentId),
        });
      case "seed_insights":
        return NextResponse.json({
          data: await platform.seedDefaultInsights(workspaceId),
        });
      case "preview_memory":
        return NextResponse.json({
          data: await platform.previewMemory(workspaceId, agentId),
        });
      case "compare_versions":
        return NextResponse.json({
          data: await platform.compareRemoteVersions(
            workspaceId,
            agentId,
            String(body.leftVersionId || ""),
            String(body.rightVersionId || ""),
          ),
        });
      case "canary_metrics":
        return NextResponse.json({
          data: await platform.canaryMetrics(workspaceId, agentId),
        });
      case "ensure_transovo_mcp":
        return NextResponse.json({
          data: await platform.ensureTransovoMcpServer(workspaceId),
        });
      case "sms_chat_preview":
        return NextResponse.json({
          data: await platform.smsChatPreview(
            workspaceId,
            agentId,
            String(body.message || ""),
            body.to ? String(body.to) : undefined,
          ),
        });
      case "import_assistants":
        return NextResponse.json({
          data: await platform.importRemoteAssistants(workspaceId, body),
        });
      case "enhance_instructions":
        return NextResponse.json({
          data: await platform.enhanceAgentInstructions(workspaceId, agentId, body),
        });
      case "delete_remote_assistant":
        return NextResponse.json({
          data: await platform.deleteRemoteAssistant(workspaceId, agentId),
        });
      case "schedule_regression":
        return NextResponse.json({
          data: await platform.scheduleRecurringRegression(workspaceId),
        });
      case "run_retention": {
        const { runVoiceAiRetention } = await import(
          "@/lib/voice/platform/retention"
        );
        return NextResponse.json({
          data: await runVoiceAiRetention(workspaceId),
        });
      }
      case "enable_web_calls":
      case "sync_voice":
        return NextResponse.json({
          data: await platform.enableWebCallsAndSyncVoice(workspaceId, agentId),
        });
      case "probe_assistant_create": {
        // Live diagnostics: try minimal Telnyx create variants and return each result.
        if (!ai.isTelnyxAiConfigured()) {
          return NextResponse.json({ error: "TELNYX_API_KEY not configured" }, { status: 400 });
        }
        const stamp = Date.now().toString(36);
        const variants: Array<{ label: string; body: Record<string, unknown> }> = [
          {
            label: "name_instructions",
            body: {
              name: `Probe ${stamp}`,
              instructions: "You are a helpful receptionist. Be brief.",
            },
          },
          {
            label: "with_qwen",
            body: {
              name: `Probe Qwen ${stamp}`,
              instructions: "You are a helpful receptionist. Be brief.",
              model: "Qwen/Qwen3-235B-A22B",
            },
          },
          {
            label: "with_llama",
            body: {
              name: `Probe Llama ${stamp}`,
              instructions: "You are a helpful receptionist. Be brief.",
              model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
            },
          },
          {
            label: "with_greeting_voice",
            body: {
              name: `Probe Voice ${stamp}`,
              instructions: "You are a helpful receptionist. Be brief.",
              greeting: "Hi, thanks for calling. How can I help?",
              voice_settings: { voice: "Telnyx.NaturalHD.andromeda" },
            },
          },
        ];
        const results = [];
        for (const v of variants) {
          try {
            const created = await ai.createAssistant(v.body);
            const id =
              created && typeof created === "object"
                ? String(
                    (created as { id?: string }).id ||
                      (created as { data?: { id?: string } }).data?.id ||
                      "",
                  )
                : "";
            results.push({ label: v.label, ok: true, id, raw: created });
            if (id) {
              await ai.deleteAssistant(id).catch(() => undefined);
            }
          } catch (err) {
            results.push({
              label: v.label,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return NextResponse.json({ data: { results } });
      }
      default:
        return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}
