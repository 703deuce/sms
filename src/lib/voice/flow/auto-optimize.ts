/**
 * Auto-optimize voice flows from recent call results:
 * failed tools, short abandoned calls, transfer misses, insight themes.
 * Produces a draft bundle patch + human-readable suggestions (never auto-publishes).
 */

import { extractJsonFromLlm, hasLlmConfigured, llmChatCompletion } from "@/lib/ai/llm";
import { getPrisma } from "@/lib/db";
import {
  parseVoiceFlowBundle,
  type VoiceFlowBundle,
  type VoiceGlobalRule,
} from "./types";
import { validateVoiceFlowBundle } from "./validation";

export type FlowSuggestion = {
  id: string;
  title: string;
  rationale: string;
  severity: "info" | "recommended" | "critical";
  kind:
    | "global_rule"
    | "instruction"
    | "tooling"
    | "routing"
    | "greeting"
    | "node";
};

export type OptimizeFlowResult = {
  suggestions: FlowSuggestion[];
  bundle: VoiceFlowBundle;
  appliedCount: number;
  stats: {
    callsAnalyzed: number;
    toolFailures: number;
    shortCalls: number;
    transferFails: number;
    wantPersonMentions: number;
  };
  mode: "llm" | "heuristic";
  provider?: string;
  model?: string;
  issues: ReturnType<typeof validateVoiceFlowBundle>;
};

function sug(
  partial: Omit<FlowSuggestion, "id"> & { id?: string },
): FlowSuggestion {
  return {
    id: partial.id || `sug_${Math.random().toString(36).slice(2, 9)}`,
    title: partial.title,
    rationale: partial.rationale,
    severity: partial.severity,
    kind: partial.kind,
  };
}

function upsertGlobalRule(bundle: VoiceFlowBundle, rule: VoiceGlobalRule) {
  const idx = bundle.globalRules.findIndex(
    (r) => r.trigger === rule.trigger || r.id === rule.id,
  );
  if (idx >= 0) {
    bundle.globalRules[idx] = { ...bundle.globalRules[idx], ...rule, enabled: true };
  } else {
    bundle.globalRules.push(rule);
  }
}

function applyHeuristicPatches(
  bundle: VoiceFlowBundle,
  stats: OptimizeFlowResult["stats"],
): { bundle: VoiceFlowBundle; suggestions: FlowSuggestion[]; applied: number } {
  const next = structuredClone(bundle);
  const suggestions: FlowSuggestion[] = [];
  let applied = 0;

  if (stats.toolFailures >= 2) {
    const s = sug({
      title: "Add tool-failure recovery rule",
      rationale: `${stats.toolFailures} recent tool failures — agents should apologize and take a message instead of hanging up.`,
      severity: "critical",
      kind: "global_rule",
    });
    suggestions.push(s);
    upsertGlobalRule(next, {
      id: "gr_tool_failure",
      name: "Tool failure recovery",
      trigger: "tool_failure",
      enabled: true,
      destinationBlockType: "take_message",
      instructions:
        "If a CRM lookup, transfer, SMS, or other tool fails or times out, apologize, stay on the line, and offer to take a message. Never hang up because a tool failed.",
    });
    applied += 1;
  }

  if (stats.wantPersonMentions >= 2 || stats.transferFails >= 1) {
    const s = sug({
      title: "Strengthen human handoff rule",
      rationale: `Callers asked for a person or transfers failed (${stats.wantPersonMentions} mentions / ${stats.transferFails} fails). Prefer escalate_human to Agent Handoff.`,
      severity: "recommended",
      kind: "global_rule",
    });
    suggestions.push(s);
    upsertGlobalRule(next, {
      id: "gr_person",
      name: "Want a real person",
      trigger: "want_person",
      enabled: true,
      destinationBlockType: "escalate_human",
      transferTargetName: "Agent Handoff",
      instructions:
        "If the caller asks for a person, human, agent, or transfer, use escalate_human to 'Agent Handoff'. Do not hang up yourself. If transfer fails, take a callback message.",
    });
    applied += 1;
  }

  if (stats.shortCalls >= 3) {
    const s = sug({
      title: "Shorten greeting / get to intent faster",
      rationale: `${stats.shortCalls} very short calls — greeting may be too long or AI may be hanging up too early.`,
      severity: "recommended",
      kind: "greeting",
    });
    suggestions.push(s);
    const greeting = next.conversation.nodes.find((n) => n.data.blockType === "greeting");
    if (greeting) {
      const text = String(greeting.data.config?.text || "");
      if (text.length > 120 || !text) {
        greeting.data.config = {
          ...greeting.data.config,
          text: "Thanks for calling. How can I help you today?",
        };
        applied += 1;
      }
    }
  }

  const hasCrm = next.conversation.nodes.some((n) =>
    ["search_crm_contacts", "lookup_customer"].includes(n.data.blockType),
  );
  if (!hasCrm && stats.callsAnalyzed >= 5) {
    suggestions.push(
      sug({
        title: "Add CRM lookup step",
        rationale:
          "No CRM lookup in the conversation flow — identifying callers early improves transfer and follow-up quality.",
        severity: "info",
        kind: "node",
      }),
    );
    next.conversation.nodes.push({
      id: `vn_crm_opt_${Math.random().toString(36).slice(2, 8)}`,
      type: "crm",
      position: { x: 360, y: 60 },
      data: {
        blockType: "search_crm_contacts",
        label: "CRM lookup",
        config: {},
      },
    });
    applied += 1;
  }

  if (!suggestions.length) {
    suggestions.push(
      sug({
        title: "No major issues detected",
        rationale: "Recent calls look healthy. Keep monitoring tool failures and short abandonments.",
        severity: "info",
        kind: "instruction",
      }),
    );
  }

  return { bundle: next, suggestions, applied };
}

async function enrichWithLlm(
  promptStats: string,
  currentSuggestions: FlowSuggestion[],
): Promise<{ extra: FlowSuggestion[]; provider?: string; model?: string } | null> {
  if (!hasLlmConfigured()) return null;
  try {
    const llm = await llmChatCompletion(
      `You optimize AI phone receptionist flows. Return JSON:
{"suggestions":[{"title":"...","rationale":"...","severity":"info|recommended|critical","kind":"global_rule|instruction|tooling|routing|greeting|node"}]}
Max 5 suggestions. Be specific and actionable. No markdown.`,
      promptStats,
      { temperature: 0.3, maxTokens: 900 },
    );
    if (!llm) return null;
    const parsed = extractJsonFromLlm(llm.content) as {
      suggestions?: Array<Partial<FlowSuggestion>>;
    };
    const extra = (parsed.suggestions || [])
      .filter((s) => s.title && s.rationale)
      .slice(0, 5)
      .map((s) =>
        sug({
          title: String(s.title),
          rationale: String(s.rationale),
          severity:
            s.severity === "critical" || s.severity === "recommended" || s.severity === "info"
              ? s.severity
              : "info",
          kind:
            s.kind === "global_rule" ||
            s.kind === "instruction" ||
            s.kind === "tooling" ||
            s.kind === "routing" ||
            s.kind === "greeting" ||
            s.kind === "node"
              ? s.kind
              : "instruction",
        }),
      );
    // Dedupe by title against existing
    const titles = new Set(currentSuggestions.map((s) => s.title.toLowerCase()));
    return {
      extra: extra.filter((s) => !titles.has(s.title.toLowerCase())),
      provider: llm.provider,
      model: llm.model,
    };
  } catch (err) {
    console.warn(
      "[flow/auto-optimize] LLM enrich failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function optimizeVoiceFlowFromCallResults(input: {
  workspaceId: string;
  agentId: string;
  currentBundle: VoiceFlowBundle;
  lookbackDays?: number;
  apply?: boolean;
}): Promise<OptimizeFlowResult> {
  const prisma = getPrisma();
  const since = new Date(
    Date.now() - Math.max(1, input.lookbackDays || 14) * 24 * 60 * 60 * 1000,
  );

  // Keep the call query flat — nested includes can break on the Prisma compat layer.
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 80,
    select: {
      id: true,
      durationSeconds: true,
      outcome: true,
      transferred: true,
      status: true,
      errorMessage: true,
    },
  });
  const callIds = calls.map((c: { id: string }) => c.id);

  const [toolRows, transferRows, insightRows, transcriptRows] = await Promise.all([
    callIds.length
      ? prisma.voiceToolExecution.findMany({
          where: { workspaceId: input.workspaceId, callId: { in: callIds } },
          select: { callId: true, status: true },
          take: 500,
        })
      : Promise.resolve([]),
    callIds.length
      ? prisma.voiceTransfer.findMany({
          where: { workspaceId: input.workspaceId, callId: { in: callIds } },
          select: { callId: true, status: true, answered: true },
          take: 200,
        })
      : Promise.resolve([]),
    callIds.length
      ? prisma.voiceConversationInsight.findMany({
          where: { workspaceId: input.workspaceId, callId: { in: callIds } },
          select: { callId: true, summary: true, topics: true },
          take: 80,
        })
      : Promise.resolve([]),
    callIds.length
      ? prisma.voiceTranscript.findMany({
          where: { workspaceId: input.workspaceId, callId: { in: callIds } },
          select: { callId: true, fullText: true },
          take: 80,
        })
      : Promise.resolve([]),
  ]);

  let toolFailures = 0;
  let shortCalls = 0;
  let transferFails = 0;
  let wantPersonMentions = 0;

  for (const call of calls) {
    const dur = call.durationSeconds ?? 0;
    if (dur > 0 && dur < 20) shortCalls += 1;
  }
  for (const t of toolRows as Array<{ status: string }>) {
    if (t.status === "failed") toolFailures += 1;
  }
  for (const x of transferRows as Array<{ status: string; answered: boolean }>) {
    if (!x.answered || ["failed", "no_answer", "cancelled"].includes(x.status)) {
      transferFails += 1;
    }
  }

  const texts = [
    ...(transcriptRows as Array<{ fullText: string | null }>).map((t) => t.fullText || ""),
    ...(insightRows as Array<{ summary: string | null; topics: unknown }>).map(
      (i) => `${i.summary || ""} ${JSON.stringify(i.topics || "")}`,
    ),
  ];
  for (const raw of texts) {
    const text = raw.toLowerCase();
    if (
      /\b(real person|human|agent|representative|speak to someone|transfer me)\b/.test(
        text,
      )
    ) {
      wantPersonMentions += 1;
    }
  }

  const stats = {
    callsAnalyzed: calls.length,
    toolFailures,
    shortCalls,
    transferFails,
    wantPersonMentions,
  };

  const { bundle: patched, suggestions, applied } = applyHeuristicPatches(
    input.currentBundle,
    stats,
  );

  const sampleInsights = (insightRows as Array<{ summary: string | null }>)
    .slice(0, 12)
    .map((i) => i.summary)
    .filter(Boolean)
    .join("\n- ");

  const llm = await enrichWithLlm(
    `Stats: ${JSON.stringify(stats)}\nSample insight summaries:\n- ${sampleInsights || "(none)"}`,
    suggestions,
  );

  if (llm?.extra.length) suggestions.push(...llm.extra);

  const finalBundle = input.apply === false ? input.currentBundle : patched;
  const normalized = parseVoiceFlowBundle(finalBundle);

  return {
    suggestions,
    bundle: normalized,
    appliedCount: input.apply === false ? 0 : applied,
    stats,
    mode: llm ? "llm" : "heuristic",
    provider: llm?.provider,
    model: llm?.model,
    issues: validateVoiceFlowBundle(normalized),
  };
}
