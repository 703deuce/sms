import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { assertLiveTwilioConfigured } from "@/lib/messaging/twilio-config";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";
import type { ProviderSearchAttempt } from "./types";

const DEFAULT_PER_SEARCH_LIMIT = 20;
const SEARCH_TIMEOUT_MS = 12_000;

type TwilioRawCandidate = {
  phoneNumber: string;
  friendlyName?: string;
  locality?: string;
  region?: string;
  raw: Record<string, unknown>;
};

export type TwilioInventorySearchOptions = {
  areaCode: string;
  endsWith?: string;
  contains?: string;
  limit?: number;
  strategy: string;
};

async function searchTwilioOnce(opts: TwilioInventorySearchOptions): Promise<{
  candidates: TwilioRawCandidate[];
  attempt: ProviderSearchAttempt;
}> {
  const limit = opts.limit ?? DEFAULT_PER_SEARCH_LIMIT;
  try {
    const client = getLiveParentClient();
    const useTollFree = isTollFreeAreaCode(opts.areaCode);
    const listParams = {
      areaCode: Number(opts.areaCode),
      contains: opts.contains || opts.endsWith || undefined,
      smsEnabled: true,
      voiceEnabled: true,
      limit,
    };
    const list = useTollFree
      ? await client.availablePhoneNumbers("US").tollFree.list(listParams)
      : await client.availablePhoneNumbers("US").local.list(listParams);
    const candidates = list.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      raw: n as unknown as Record<string, unknown>,
    }));
    return {
      candidates,
      attempt: {
        provider: "twilio",
        strategy: opts.strategy,
        status: "ok",
        resultCount: candidates.length,
      },
    };
  } catch (err) {
    return {
      candidates: [],
      attempt: {
        provider: "twilio",
        strategy: opts.strategy,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("provider_timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function runTwilioInventorySearches(input: {
  areaCode: string;
  keywordDigitStrings: string[];
  memorablePatterns: string[];
  baseLimit?: number;
  matchStyle?: "ends_with" | "contains" | "both";
}): Promise<{ candidates: TwilioRawCandidate[]; attempts: ProviderSearchAttempt[] }> {
  try {
    assertLiveTwilioConfigured();
  } catch (err) {
    return {
      candidates: [],
      attempts: [
        {
          provider: "twilio",
          strategy: "inventory",
          status: "skipped",
          error: err instanceof Error ? err.message : "Twilio not configured",
        },
      ],
    };
  }

  const perSearch = Math.max(5, Math.floor((input.baseLimit ?? 50) / 4));
  const tasks: TwilioInventorySearchOptions[] = [];
  const matchStyle = input.matchStyle ?? "both";

  for (const digits of input.keywordDigitStrings) {
    if (!digits) continue;
    if (matchStyle === "ends_with" || matchStyle === "both") {
      tasks.push({
        areaCode: input.areaCode,
        contains: digits,
        strategy: `keyword_contains:${digits}`,
        limit: perSearch,
      });
    }
    if (matchStyle === "contains" || matchStyle === "both") {
      tasks.push({
        areaCode: input.areaCode,
        contains: digits,
        strategy: `keyword_contains:${digits}`,
        limit: perSearch,
      });
    }
  }

  for (const pattern of input.memorablePatterns.slice(0, 12)) {
    tasks.push({
      areaCode: input.areaCode,
      contains: pattern,
      strategy: `memorable:${pattern}`,
      limit: perSearch,
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      areaCode: input.areaCode,
      strategy: "area_browse",
      limit: input.baseLimit ?? 30,
    });
  }

  const attempts: ProviderSearchAttempt[] = [];
  const candidates: TwilioRawCandidate[] = [];

  for (const task of tasks) {
    try {
      const result = await withTimeout(searchTwilioOnce(task), SEARCH_TIMEOUT_MS);
      attempts.push(result.attempt);
      candidates.push(...result.candidates);
    } catch (err) {
      attempts.push({
        provider: "twilio",
        strategy: task.strategy,
        status: "timeout",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { candidates, attempts };
}
