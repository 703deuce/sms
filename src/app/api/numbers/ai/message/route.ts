import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { buildUnderstandingChips } from "@/lib/premium-numbers/ai-number-search/chips";
import {
  compareNumberResults,
  explainNumberResult,
} from "@/lib/premium-numbers/ai-number-search/explain";
import {
  applyAiAction,
  buildIndustryPatch,
  parseAiSearchMessage,
} from "@/lib/premium-numbers/ai-number-search/intent";
import {
  getOrCreateAiSession,
  pushMessage,
  resetAiSession,
  saveAiSession,
} from "@/lib/premium-numbers/ai-number-search/session";
import { applySearchStatePatch } from "@/lib/premium-numbers/ai-number-search/state";
import type { NumberSearchState } from "@/lib/premium-numbers/ai-number-search/types";

type Body = {
  workspaceId?: string;
  sessionId?: string;
  message?: string;
  quickAction?: string;
  currentSearchState?: NumberSearchState;
  selectedNumberIds?: string[];
  resultSummaries?: Array<{
    phoneNumber: string;
    displayNumber: string;
    premiumPriceCents: number;
    businessMatchScore: number;
    numberQualityScore: number;
    displayWord?: string;
    vanityDisplay?: string;
    cardBullets?: string[];
    whyReasons?: string[];
    businessMatchLabel?: string;
    memorabilityLabel?: string;
    premiumPriceBand?: string;
    matchedWords?: string[];
    patterns?: string[];
    headlineLabel?: string;
    tags?: string[];
    provider?: string;
    listSection?: string;
  }>;
};

function searchSummary(state: NumberSearchState): string {
  const parts = [
    state.areaCodes.length ? `area codes ${state.areaCodes.join(", ")}` : null,
    state.industry ? `industry ${state.industry}` : null,
    state.keywords.length ? `keywords ${state.keywords.join(", ")}` : null,
    state.maxPriceCents ? `max price $${(state.maxPriceCents / 100).toFixed(0)}` : null,
  ].filter(Boolean);
  return parts.join("; ") || "general number search";
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as Body | null;
  const message = (body?.message ?? body?.quickAction ?? "").trim();
  if (!message) return jsonError("message is required", 400);

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const session = getOrCreateAiSession({
      sessionId: body?.sessionId,
      workspaceId,
      userId: auth.session.userId,
      initialSearchState: body?.currentSearchState,
    });

    if (body?.currentSearchState) {
      session.searchState = applySearchStatePatch(session.searchState, body.currentSearchState);
    }

    pushMessage(session, "user", message);

    const parsed = await parseAiSearchMessage({
      message,
      quickAction: body?.quickAction,
      searchState: session.searchState,
      selectedNumberIds: body?.selectedNumberIds,
      resultSummaries: body?.resultSummaries,
    });

    if (parsed.action.type === "NEW_SEARCH") {
      resetAiSession(session);
    }

    let assistantText = parsed.assistantMessage;

    if (parsed.action.type === "EXPLAIN_RESULT") {
      const resultId =
        parsed.action.type === "EXPLAIN_RESULT" ? parsed.action.resultId : "";
      const hit = body?.resultSummaries?.find((r) => r.phoneNumber === resultId);
      if (hit) {
        assistantText = await explainNumberResult({
          searchSummary: searchSummary(session.searchState),
          result: hit as import("@/lib/premium-numbers/product-api").PremiumNumberProductResult,
        });
      }
    }

    if (parsed.action.type === "COMPARE_RESULTS") {
      const ids = parsed.action.resultIds.length
        ? parsed.action.resultIds
        : (body?.resultSummaries?.slice(0, 3).map((r) => r.phoneNumber) ?? []);
      const picks = body?.resultSummaries?.filter((r) => ids.includes(r.phoneNumber)) ?? [];
      if (picks.length >= 2) {
        assistantText = await compareNumberResults({
          searchSummary: searchSummary(session.searchState),
          results: picks as import("@/lib/premium-numbers/product-api").PremiumNumberProductResult[],
        });
      }
    }

    const applied = applyAiAction(session.searchState, parsed.action);
    session.searchState = applied.state;

    if (parsed.action.type === "UPDATE_SEARCH" && applied.searchChanged) {
      const patch = parsed.action.patch;
      if (patch.industry && !patch.aiGeneratedKeywords?.length) {
        const industryPatch = await buildIndustryPatch(patch.industry);
        session.searchState = applySearchStatePatch(session.searchState, industryPatch);
      }
    }

    if (applied.searchPerformed) {
      session.lastSearchAt = new Date().toISOString();
    }

    pushMessage(session, "assistant", assistantText);
    saveAiSession(session);

    console.info(
      JSON.stringify({
        scope: "find_number_ai",
        event: "ai_message",
        workspace_id: workspaceId,
        session_id: session.id,
        search_performed: applied.searchPerformed,
        action: parsed.action.type,
      }),
    );

    return NextResponse.json({
      sessionId: session.id,
      assistantMessage: assistantText,
      searchState: session.searchState,
      searchChanged: applied.searchChanged,
      searchPerformed: applied.searchPerformed,
      suggestedActions: parsed.suggestedActions,
      messages: session.messages,
      understandingChips: buildUnderstandingChips(session.searchState),
      explainOnly:
        parsed.action.type === "EXPLAIN_RESULT" ||
        parsed.action.type === "COMPARE_RESULTS",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return jsonError(msg, 500);
  }
}
