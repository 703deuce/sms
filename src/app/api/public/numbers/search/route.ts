import { NextResponse } from "next/server";
import { getTrustedClientIp } from "@/lib/http/client-ip";
import { executePremiumSearch } from "@/lib/premium-numbers/execute-premium-search";
import type { PremiumSearchSnapshot } from "@/lib/premium-numbers/execute-premium-search";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { getPublicLandingSearchContext } from "@/lib/premium-numbers/public-landing-context";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import type { NumberType, TollFreePrefix } from "@/lib/premium-numbers/toll-free";

type SearchBody = {
  mode?: PremiumSearchMode;
  areaCode?: string;
  areaCodes?: string[];
  numberType?: NumberType;
  tollFreePrefix?: TollFreePrefix;
  industry?: string;
  suggestedKeywords?: string[];
  extraKeywords?: string[];
  customKeywords?: string[];
  preferences?: PersonalPreference[];
  limit?: number;
  stream?: boolean;
};

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string | null): boolean {
  const key = ip ?? "unknown";
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function wantsNdjsonStream(request: Request, body: SearchBody | null): boolean {
  if (body?.stream === false) return false;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/x-ndjson") || body?.stream === true;
}

export async function POST(request: Request) {
  const ip = getTrustedClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many searches — try again shortly" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as SearchBody | null;

  try {
    const ctx = await getPublicLandingSearchContext();
    const mode: PremiumSearchMode = body?.mode === "business" ? "business" : "personal";

    trackNumbersLandingEvent("manual_search_started", { mode });

    if (wantsNdjsonStream(request, body)) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };
          try {
            await executePremiumSearch(
              {
                workspaceId: ctx.workspaceId,
                userId: ctx.userId,
                mode,
                areaCode: body?.areaCode,
                areaCodes: body?.areaCodes,
                numberType: body?.numberType,
                tollFreePrefix: body?.tollFreePrefix,
                industry: body?.industry,
                suggestedKeywords: body?.suggestedKeywords,
                extraKeywords: body?.extraKeywords,
                customKeywords: body?.customKeywords,
                preferences: body?.preferences,
                limit: body?.limit ?? 80,
              },
              {
                onSnapshot: (snapshot: PremiumSearchSnapshot) => {
                  write({
                    type: snapshot.searchStatus === "complete" ? "complete" : "partial",
                    data: snapshot,
                  });
                },
              },
            );
            trackNumbersLandingEvent("search_completed", { mode });
            controller.close();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            write({ type: "error", error: message });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await executePremiumSearch({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      mode,
      areaCode: body?.areaCode,
      areaCodes: body?.areaCodes,
      numberType: body?.numberType,
      tollFreePrefix: body?.tollFreePrefix,
      industry: body?.industry,
      suggestedKeywords: body?.suggestedKeywords,
      extraKeywords: body?.extraKeywords,
      customKeywords: body?.customKeywords,
      preferences: body?.preferences,
      limit: body?.limit ?? 80,
    });

    trackNumbersLandingEvent("search_completed", {
      mode,
      resultCount: result.product.resultCount,
    });

    return NextResponse.json(result.product);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
