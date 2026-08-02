import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  TOOL_CATALOG,
  catalogByCategory,
  defaultBuiltinToolsForAgentType,
  getCatalogTool,
  resolveEnabledBuiltinTools,
} from "@/lib/voice/tools/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
      select: { id: true, agentType: true, draftConfig: true },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const links = await prisma.voiceAgentTool.findMany({
      where: { agentId, workspaceId: auth.workspaceId },
      include: {
        tool: {
          select: { id: true, name: true, toolType: true, status: true, description: true },
        },
      },
    });

    const draft = (agent.draftConfig || {}) as {
      enabledBuiltinTools?: string[];
      toolIds?: string[];
    };
    const enabledBuiltinTools = resolveEnabledBuiltinTools({
      enabledBuiltinTools: draft.enabledBuiltinTools,
      agentType: agent.agentType,
    });

    return NextResponse.json({
      data: links.map((l: (typeof links)[number]) => ({
        id: l.id,
        toolId: l.toolId,
        ...l.tool,
      })),
      enabledBuiltinTools,
      catalog: catalogByCategory(),
      defaults: defaultBuiltinToolsForAgentType(agent.agentType),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as {
      toolIds?: string[];
      enabledBuiltinTools?: string[];
    };
    const ids = body.toolIds || [];
    const builtinKeys = Array.isArray(body.enabledBuiltinTools)
      ? body.enabledBuiltinTools.filter((k) => Boolean(getCatalogTool(k)))
      : undefined;

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().voiceAgentTool.deleteMany({
      where: { agentId, workspaceId: auth.workspaceId },
    });
    for (const toolId of ids) {
      const tool = await getPrisma().voiceTool.findFirst({
        where: { id: toolId, workspaceId: auth.workspaceId },
      });
      if (!tool) continue;
      await getPrisma().voiceAgentTool.create({
        data: { workspaceId: auth.workspaceId, agentId, toolId },
      });
    }

    const draft = (agent.draftConfig || {}) as Record<string, unknown>;
    const nextDraft: Record<string, unknown> = { ...draft, toolIds: ids };
    if (builtinKeys) {
      nextDraft.enabledBuiltinTools = builtinKeys;
    }
    const updated = await getPrisma().voiceAgent.update({
      where: { id: agentId },
      data: { draftConfig: nextDraft },
    });

    // Keep Telnyx assistant in sync so the next call gets the new tool set.
    let synced = false;
    let toolSync: unknown = null;
    let toolSyncError: string | null = null;
    let assistantId: string | null = updated.telnyxAssistantId;
    if (updated.telnyxAssistantId || builtinKeys) {
      try {
        const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
        const { syncTelnyxAssistant } = await import(
          "@/lib/voice/telnyx/assistant-sync"
        );
        const syncResult = (await syncTelnyxAssistant(
          auth.workspaceId,
          updated as never,
          parseVoiceAgentConfig(nextDraft),
        )) as {
          assistantId?: string;
          toolSync?: unknown;
          toolSyncError?: string | null;
          recreated?: boolean;
        };
        synced = true;
        toolSync = syncResult.toolSync || null;
        toolSyncError = syncResult.toolSyncError || null;
        assistantId = syncResult.assistantId || assistantId;
        const types = (syncResult.toolSync as { remoteTypes?: string[] } | undefined)
          ?.remoteTypes;
        if (types && types.length === 1 && types[0] === "hangup" && (builtinKeys?.length || 0) > 1) {
          toolSyncError =
            toolSyncError ||
            "Telnyx assistant still hangup-only after sync — transfer/CRM tools did not stick";
          synced = false;
        }
      } catch (err) {
        toolSyncError = err instanceof Error ? err.message : String(err);
        console.warn("[voice/tools] sync after save failed", toolSyncError);
      }
    }

    return NextResponse.json({
      data: {
        toolIds: ids,
        enabledBuiltinTools:
          builtinKeys ??
          resolveEnabledBuiltinTools({
            enabledBuiltinTools: draft.enabledBuiltinTools as string[] | undefined,
            agentType: agent.agentType,
          }),
        catalogSize: TOOL_CATALOG.length,
        synced,
        toolSync,
        toolSyncError,
        telnyxAssistantId: assistantId,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
