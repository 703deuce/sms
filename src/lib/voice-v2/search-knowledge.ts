import "server-only";

import { getPrisma } from "@/lib/db";
import { searchKnowledge } from "@/lib/voice/knowledge-processor";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isVoiceV2KnowledgeSearchEnabled,
  resolveVoiceV2KnowledgeConfig,
  type VoiceV2PublishedKnowledgeConfig,
} from "./knowledge-config";
import type { VoiceV2CallContext } from "./intake/types";

export type VoiceV2KnowledgeSearchResult =
  | {
      status: "FOUND";
      answerable: true;
      results: Array<{
        source_title: string;
        source_id: string;
        relevant_text: string;
        knowledge_base_id: string;
      }>;
      knowledge_revision: string;
      speak_hint: string;
    }
  | {
      status: "KNOWLEDGE_NOT_FOUND";
      answerable: false;
      results: [];
      knowledge_revision: string;
      speak_hint: string;
    }
  | {
      status: "KNOWLEDGE_DISABLED" | "ERROR";
      error: string;
      speak_hint: string;
    };

const MAX_RESULTS = 3;
const MAX_SNIPPET_CHARS = 420;

function sanitizeSnippet(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SNIPPET_CHARS);
}

/** Strip obvious instruction-injection lines from untrusted document content. */
function stripInjectionLines(text: string): string {
  const lines = text.split(/\n/);
  const kept = lines.filter((line) => {
    const l = line.toLowerCase();
    if (l.includes("ignore all prior instructions")) return false;
    if (l.includes("ignore your system prompt")) return false;
    if (l.includes("you are now")) return false;
    return true;
  });
  return kept.join(" ").trim();
}

export async function resolveAgentKnowledgeBaseIds(
  workspaceId: string,
  agentId: string,
  pinned: VoiceV2PublishedKnowledgeConfig,
): Promise<string[]> {
  const prisma = getPrisma();
  const allowed = new Set(pinned.knowledgeBaseIds);
  if (!allowed.size) return [];

  const rows = await prisma.voiceKnowledgeBase.findMany({
    where: {
      workspaceId,
      id: { in: [...allowed] },
      status: "active",
    },
    select: { id: true },
  });
  const fromPinned = rows.map((r) => r.id);

  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { workspaceId, agentId },
    select: { knowledgeBaseId: true },
  });
  const linked = links
    .map((l) => l.knowledgeBaseId)
    .filter((id) => allowed.has(id));

  const merged = [...new Set([...fromPinned, ...linked])].filter((id) => allowed.has(id));
  return merged;
}

function scoreHit(
  query: string,
  hit: { snippet: string; distance?: number; provider?: string },
): number {
  if (typeof hit.distance === "number") {
    return 1 / (1 + hit.distance);
  }
  const q = query.toLowerCase();
  const sn = hit.snippet.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  if (!terms.length) return sn.includes(q) ? 1 : 0;
  const matched = terms.filter((t) => sn.includes(t)).length;
  return matched / terms.length;
}

export async function assertVoiceV2KnowledgeSearchAllowed(input: {
  workspaceId: string;
  agentId: string;
  ctx?: VoiceV2CallContext | null;
}): Promise<{ allowed: true; config: VoiceV2PublishedKnowledgeConfig } | { allowed: false }> {
  const pinnedKb = input.ctx?.capabilities?.knowledgeBaseIds;
  const pinnedEnabled = input.ctx?.capabilities?.knowledgeBaseEnabled;
  if (pinnedEnabled === false) return { allowed: false };
  if (pinnedEnabled === true && pinnedKb?.length) {
    return {
      allowed: true,
      config: {
        promptKnowledgeEnabled: true,
        knowledgeBaseEnabled: true,
        knowledgeBaseRevision:
          input.ctx?.capabilities?.knowledgeBaseRevision || "pinned",
        knowledgeBaseIds: pinnedKb,
      },
    };
  }
  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  if (!isVoiceV2KnowledgeSearchEnabled(config)) return { allowed: false };
  return { allowed: true, config: resolveVoiceV2KnowledgeConfig(config) };
}

export async function executeVoiceV2SearchKnowledge(
  raw: Record<string, unknown>,
  workspaceId: string,
  agentId: string,
  options?: { ctx?: VoiceV2CallContext | null; voiceCallId?: string | null },
): Promise<VoiceV2KnowledgeSearchResult> {
  const query = String(raw.query || raw.question || "").trim();
  if (!query) {
    return {
      status: "ERROR",
      error: "query_required",
      speak_hint: "I need a bit more detail about what you would like to know.",
    };
  }

  const gate = await assertVoiceV2KnowledgeSearchAllowed({
    workspaceId,
    agentId,
    ctx: options?.ctx ?? null,
  });
  if (!gate.allowed) {
    return {
      status: "KNOWLEDGE_DISABLED",
      error: "knowledge_base_disabled",
      speak_hint:
        "I do not have searchable documents for that right now. I can take a message for the team.",
    };
  }

  const kbIds = await resolveAgentKnowledgeBaseIds(workspaceId, agentId, gate.config);
  if (!kbIds.length) {
    return {
      status: "KNOWLEDGE_NOT_FOUND",
      answerable: false,
      results: [],
      knowledge_revision: gate.config.knowledgeBaseRevision,
      speak_hint:
        "I do not have that specific information available. I can make sure the team gets your question.",
    };
  }

  const ranked: Array<{
    source_title: string;
    source_id: string;
    relevant_text: string;
    knowledge_base_id: string;
    score: number;
  }> = [];

  for (const kbId of kbIds) {
    const hits = await searchKnowledge(workspaceId, kbId, query);
    for (const hit of hits) {
      const score = scoreHit(query, hit);
      if (score < 0.25) continue;
      const text = sanitizeSnippet(stripInjectionLines(hit.snippet || ""));
      if (!text) continue;
      ranked.push({
        source_title: hit.name || "Business document",
        source_id: hit.sourceId,
        relevant_text: text,
        knowledge_base_id: kbId,
        score,
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, MAX_RESULTS);

  void recordKnowledgeSearchTelemetry({
    workspaceId,
    voiceCallId: options?.voiceCallId,
    agentId,
    query,
    knowledgeRevision: gate.config.knowledgeBaseRevision,
    kbIds,
    resultCount: top.length,
  });

  if (!top.length) {
    return {
      status: "KNOWLEDGE_NOT_FOUND",
      answerable: false,
      results: [],
      knowledge_revision: gate.config.knowledgeBaseRevision,
      speak_hint:
        "I do not have that specific information in our materials. I can have someone follow up with you.",
    };
  }

  return {
    status: "FOUND",
    answerable: true,
    results: top.map(({ score: _s, ...rest }) => rest),
    knowledge_revision: gate.config.knowledgeBaseRevision,
    speak_hint:
      "Answer in your own words using only the retrieved passages. Do not read citations aloud.",
  };
}

function recordKnowledgeSearchTelemetry(input: {
  workspaceId: string;
  voiceCallId?: string | null;
  agentId: string;
  query: string;
  knowledgeRevision: string;
  kbIds: string[];
  resultCount: number;
}) {
  void (async () => {
    try {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      if (!input.voiceCallId) return;
      const call = await prisma.voiceCall.findFirst({
        where: {
          workspaceId: input.workspaceId,
          OR: [{ id: input.voiceCallId }, { telnyxCallControlId: input.voiceCallId }],
        },
        select: { id: true },
      });
      if (!call) return;
      await prisma.voiceCallEvent.create({
        data: {
          workspaceId: input.workspaceId,
          callId: call.id,
          eventType: "KNOWLEDGE_SEARCH",
          payload: {
            agent_id: input.agentId,
            query: input.query.slice(0, 500),
            knowledge_revision: input.knowledgeRevision,
            knowledge_base_ids: input.kbIds,
            result_count: input.resultCount,
            answerable: input.resultCount > 0,
          },
        },
      });
    } catch {
      // nonblocking
    }
  })();
}
