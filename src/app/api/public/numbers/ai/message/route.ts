import { NextResponse } from "next/server";
import { getTrustedClientIp } from "@/lib/http/client-ip";
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
  toCustomerSafeNumberResult,
  toCustomerSafeNumberResults,
} from "@/lib/premium-numbers/ai-number-search/customer-context";
import { sanitizeCustomerAiOutput } from "@/lib/premium-numbers/ai-number-search/output-sanitizer";
import {
  getOrCreateAiSession,
  pushMessage,
  resetAiSession,
  saveAiSession,
} from "@/lib/premium-numbers/ai-number-search/session";
import { applySearchStatePatch } from "@/lib/premium-numbers/ai-number-search/state";
import type { NumberSearchState } from "@/lib/premium-numbers/ai-number-search/types";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { getPublicLandingSearchContext } from "@/lib/premium-numbers/public-landing-context";

type Body = {
  sessionId?: string;
  message?: string;
  quickAction?: string;
  currentSearchState?: NumberSearchState;
  selectedNumberIds?: string[];
  resultSummaries?: Array<Record<string, unknown>>;
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

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string | null): boolean {
  const key = ip ?? "unknown";
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const ip = getTrustedClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many AI requests — try again shortly" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const message = (body?.message ?? body?.quickAction ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const ctx = await getPublicLandingSearchContext();
    trackNumbersLandingEvent("ai_search_started");

    const session = getOrCreateAiSession({
      sessionId: body?.sessionId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      initialSearchState: body?.currentSearchState,
    });

    if (body?.currentSearchState) {
      session.searchState = applySearchStatePatch(session.searchState, body.currentSearchState);
    }

    pushMessage(session, "user", message);

    const safeSummaries = (body?.resultSummaries ?? []).map((r) =>
      toCustomerSafeNumberResult(
        r as import("@/lib/premium-numbers/product-api").PremiumNumberProductResult,
      ),
    );

    const parsed = await parseAiSearchMessage({
      message,
      quickAction: body?.quickAction,
      searchState: session.searchState,
      selectedNumberIds: body?.selectedNumberIds,
      resultSummaries: safeSummaries,
    });

    if (parsed.action.type === "NEW_SEARCH") {
      resetAiSession(session);
    }

    let assistantText = parsed.assistantMessage;

    if (parsed.action.type === "EXPLAIN_RESULT") {
      const resultId = parsed.action.resultId;
      const hit = body?.resultSummaries?.find(
        (r) => (r as { phoneNumber?: string }).phoneNumber === resultId,
      );
      if (hit) {
        assistantText = await explainNumberResult({
          searchSummary: searchSummary(session.searchState),
          result: toCustomerSafeNumberResult(
            hit as import("@/lib/premium-numbers/product-api").PremiumNumberProductResult,
          ),
        });
      }
    }

    if (parsed.action.type === "COMPARE_RESULTS") {
      const ids = parsed.action.resultIds.length
        ? parsed.action.resultIds
        : (body?.resultSummaries?.slice(0, 3).map((r) => (r as { phoneNumber: string }).phoneNumber) ??
          []);
      const picks =
        body?.resultSummaries?.filter((r) =>
          ids.includes((r as { phoneNumber: string }).phoneNumber),
        ) ?? [];
      if (picks.length >= 2) {
        assistantText = await compareNumberResults({
          searchSummary: searchSummary(session.searchState),
          results: toCustomerSafeNumberResults(
            picks as import("@/lib/premium-numbers/product-api").PremiumNumberProductResult[],
          ),
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

    const allowedPhones =
      body?.resultSummaries?.map((r) => (r as { phoneNumber: string }).phoneNumber) ?? [];
    const allowedDisplays =
      body?.resultSummaries?.map((r) => (r as { displayNumber: string }).displayNumber) ?? [];
    assistantText = sanitizeCustomerAiOutput(assistantText, allowedPhones, allowedDisplays);

    pushMessage(session, "assistant", assistantText);
    saveAiSession(session);

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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
