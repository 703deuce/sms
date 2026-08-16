import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  executePremiumSearch,
  type PremiumSearchSnapshot,
} from "@/lib/premium-numbers/execute-premium-search";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import {
  type NumberType,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";

type SearchBody = {
  workspaceId?: string;
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

function wantsNdjsonStream(request: Request, body: SearchBody | null): boolean {
  if (body?.stream === false) return false;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/x-ndjson") || body?.stream === true;
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as SearchBody | null;

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const mode: PremiumSearchMode = body?.mode === "personal" ? "personal" : "business";

    if (wantsNdjsonStream(request, body)) {
      const prisma = getPrisma();
      const placeholderLog = await prisma.premiumNumberSearchLog.create({
        data: {
          workspaceId,
          userId: auth.session.userId,
          mode: mode.toUpperCase(),
          areaCode: body?.areaCode?.replace(/\D/g, "").slice(0, 3) ?? "",
          industry: body?.industry ?? null,
          keywordsJson: {
            searchStatus: "searching",
            areaCodes: body?.areaCodes ?? [],
            industry: body?.industry ?? null,
          },
          businessMatchCount: 0,
          memorableMatchCount: 0,
          totalResults: 0,
          resultsJson: [],
        },
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          try {
            await executePremiumSearch(
              {
                workspaceId,
                userId: auth.session.userId,
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
                limit: body?.limit,
                searchLogId: placeholderLog.id,
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
      workspaceId,
      userId: auth.session.userId,
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
      limit: body?.limit,
    });

    return NextResponse.json(result.product);
  } catch (err) {
    return jsonError(err, 400);
  }
}
