/**
 * Authorize a browser WebRTC test against a workspace-owned Telnyx assistant.
 * Never returns TELNYX_API_KEY — only the assistant id for anonymous_login.
 */

import { createHash, randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  getCuratedVoice,
  resolveProviderVoiceId,
  voiceLabel,
} from "@/lib/voice/telnyx/voices";
import * as platform from "@/lib/voice/platform/ai-platform";

const hits = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit = 20) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now - row.windowStart > 60_000) {
    hits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export type TestSessionResult =
  | {
      ok: true;
      sessionId: string;
      agentId: string;
      telnyxAssistantId: string;
      /** Opaque connection config for TelnyxRTC anonymous_login — no API key. */
      webrtc: {
        target_type: "ai_assistant";
        target_id: string;
        target_params?: Record<string, string>;
      };
      voice: {
        catalogId: string | null;
        displayName: string;
        providerVoiceId: string;
      };
      synced: boolean;
      expiresAt: string;
      testVariables: Record<string, string>;
    }
  | { ok: false; code: string; error: string; status: number };

export async function createVoiceTestSession(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  /** When true, sync full assistant + enable web calls before returning. */
  sync?: boolean;
  testVariables?: Record<string, string>;
}): Promise<TestSessionResult> {
  const rateKey = `${input.workspaceId}:${input.userId}`;
  if (!rateOk(rateKey)) {
    return {
      ok: false,
      code: "rate_limited",
      error: "Too many test sessions — wait a minute and try again.",
      status: 429,
    };
  }

  const prisma = getPrisma();
  let agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) {
    return { ok: false, code: "not_found", error: "Agent not found", status: 404 };
  }
  if (agent.emergencyDisabled) {
    return {
      ok: false,
      code: "emergency_disabled",
      error: "Agent is emergency-stopped",
      status: 403,
    };
  }
  if (!agent.telnyxAssistantId) {
    return {
      ok: false,
      code: "not_built",
      error: "Build & test first so Telnyx can sync the assistant",
      status: 400,
    };
  }

  let synced = false;
  if (input.sync !== false) {
    try {
      const config = parseVoiceAgentConfig(agent.draftConfig);
      const { syncTelnyxAssistant } = await import("@/lib/voice/telnyx/assistant-sync");
      // Full assistant sync so browser hears the same instructions/KB/tools/voice as phone.
      await syncTelnyxAssistant(input.workspaceId, agent, config);
      await platform.enableWebCallsAndSyncVoice(input.workspaceId, input.agentId);
      synced = true;
      agent =
        (await prisma.voiceAgent.findFirst({
          where: { id: input.agentId, workspaceId: input.workspaceId },
        })) || agent;
    } catch (err) {
      await platform
        .recordFailureDiagnostic({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          category: "test_session",
          code: "sync_before_call_failed",
          message: err instanceof Error ? err.message : String(err),
        })
        .catch(() => undefined);
      // Still allow call if assistant exists — config may be stale; client shows synced=false.
    }
  }

  if (!agent.telnyxAssistantId) {
    return {
      ok: false,
      code: "not_built",
      error: "Build & test first so Telnyx can sync the assistant",
      status: 400,
    };
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const stored = config.voiceLanguage?.voiceId || "";
  const curated = getCuratedVoice(stored);
  const providerVoiceId = resolveProviderVoiceId(stored);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  let workspaceName = input.workspaceId.slice(0, 8);
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true, displayName: true },
    });
    workspaceName = ws?.displayName || ws?.name || workspaceName;
  } catch {
    // ignore
  }

  const testVariables: Record<string, string> = {
    telnyx_conversation_channel: "web_call",
    workspace_name: workspaceName,
    test_caller_name: "Browser Tester",
    ...((input.testVariables || {}) as Record<string, string>),
  };

  await platform
    .recordFailureDiagnostic({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      category: "test_session",
      code: "session_start",
      message: `WebRTC test session ${sessionId} started by ${input.userId}`,
      detailsJson: {
        sessionId,
        telnyxAssistantId: agent.telnyxAssistantId,
        providerVoiceId,
        synced,
        expiresAt,
      },
    })
    .catch(() => undefined);

  return {
    ok: true,
    sessionId,
    agentId: agent.id,
    telnyxAssistantId: agent.telnyxAssistantId,
    webrtc: {
      target_type: "ai_assistant",
      target_id: agent.telnyxAssistantId,
      // Forwarded as SIP headers / assistant params where Telnyx supports them.
      target_params: testVariables,
    },
    voice: {
      catalogId: curated?.catalogId || null,
      displayName: voiceLabel(stored),
      providerVoiceId,
    },
    synced,
    expiresAt,
    testVariables,
  };
}

export async function endVoiceTestSession(input: {
  workspaceId: string;
  agentId: string;
  sessionId: string;
  durationSec?: number;
  conversationId?: string | null;
  error?: string | null;
}) {
  await platform
    .recordFailureDiagnostic({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      category: "test_session",
      code: input.error ? "session_failed" : "session_end",
      message: input.error
        ? `WebRTC test session ${input.sessionId} failed: ${input.error}`
        : `WebRTC test session ${input.sessionId} ended`,
      detailsJson: {
        sessionId: input.sessionId,
        durationSec: input.durationSec ?? null,
        conversationId: input.conversationId ?? null,
      },
    })
    .catch(() => undefined);

  let transcript: Array<{ role: string; content: string }> = [];
  let localConversationId: string | null = null;

  if (input.conversationId) {
    const prisma = getPrisma();
    const existing = await prisma.voiceAiConversation.findFirst({
      where: {
        workspaceId: input.workspaceId,
        telnyxConversationId: input.conversationId,
      },
    });
    if (existing) {
      const updated = await prisma.voiceAiConversation
        .update({
          where: { id: existing.id },
          data: {
            channel: "web_call_test",
            status: "ended",
            endedAt: new Date(),
            metadata: {
              ...((existing.metadata as object) || {}),
              testSessionId: input.sessionId,
              test: true,
              durationSec: input.durationSec ?? null,
            } as object,
          },
        })
        .catch(() => null);
      localConversationId = updated?.id || existing.id;
    } else {
      const created = await prisma.voiceAiConversation
        .create({
          data: {
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            telnyxConversationId: input.conversationId,
            channel: "web_call_test",
            status: "ended",
            endedAt: new Date(),
            metadata: {
              testSessionId: input.sessionId,
              test: true,
              durationSec: input.durationSec ?? null,
            } as object,
          },
        })
        .catch(() => null);
      localConversationId = created?.id || null;
    }

    try {
      const ai = await import("@/lib/voice/telnyx/ai-client");
      if (ai.isTelnyxAiConfigured()) {
        const remote = await ai.listConversationMessages(input.conversationId);
        const data = (remote as { data?: unknown }).data;
        const rows = Array.isArray(data)
          ? data
          : Array.isArray((data as { messages?: unknown })?.messages)
            ? (data as { messages: unknown[] }).messages
            : [];
        transcript = rows
          .map((m) => {
            const row = m as Record<string, unknown>;
            return {
              role: String(row.role || row.speaker || "unknown"),
              content: String(row.content || row.text || row.message || "").trim(),
            };
          })
          .filter((m) => m.content);
      }
    } catch {
      // transcript optional
    }
  }

  return {
    ok: true,
    localConversationId,
    transcript,
    labeledTest: true,
  };
}

export function previewCacheKey(voiceId: string, text: string, speed?: number) {
  return createHash("sha256")
    .update(`${voiceId}|${text}|${speed ?? 1}`)
    .digest("hex")
    .slice(0, 32);
}
