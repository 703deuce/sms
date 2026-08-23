import { logProviderRun } from "@/lib/providers/dataforseo";
import type { OpportunityType } from "@/lib/local-trust/types";
import { hasTrustSignals } from "@/lib/local-trust/filter";

const BASE_URL = "https://api.deepseek.com/v1";
const BATCH_SIZE = 20;

export type LlmFilterItem = {
  url: string;
  title: string;
  domain: string;
  snippet: string;
  opportunityType: OpportunityType;
};

export type LlmFilterVerdict = {
  url: string;
  verdict: "keep" | "reject";
  reason: string;
  opportunityType?: OpportunityType;
};

const VALID_TYPES: OpportunityType[] = [
  "chamber",
  "local_directory",
  "local_news",
  "community_event",
  "charity",
  "school_sponsor",
  "hoa_vendor",
  "city_county",
  "vendor_list",
  "cleanup_event",
  "industry_local",
  "other",
];

export async function filterLocalTrustWithLlm(params: {
  organizationId?: string;
  businessName: string;
  city: string;
  county: string;
  state: string;
  category: string;
  items: LlmFilterItem[];
}): Promise<Map<string, LlmFilterVerdict>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const results = new Map<string, LlmFilterVerdict>();

  if (!apiKey || params.items.length === 0) {
    for (const item of params.items) {
      results.set(item.url, {
        url: item.url,
        verdict: "keep",
        reason: "LLM unavailable — deferred to page verification",
      });
    }
    return results;
  }

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  for (let i = 0; i < params.items.length; i += BATCH_SIZE) {
    const batch = params.items.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch({
      apiKey,
      model,
      organizationId: params.organizationId,
      context: {
        businessName: params.businessName,
        city: params.city,
        county: params.county,
        state: params.state,
        category: params.category,
      },
      batch,
    });

    for (const v of batchResults) {
      results.set(v.url, v);
    }
  }

  return results;
}

async function classifyBatch(params: {
  apiKey: string;
  model: string;
  organizationId?: string;
  context: {
    businessName: string;
    city: string;
    county: string;
    state: string;
    category: string;
  };
  batch: LlmFilterItem[];
}): Promise<LlmFilterVerdict[]> {
  const systemPrompt = `You filter local trust and sponsorship opportunities for a local business.
Decide whether each search result is a REAL place the business could get listed, sponsored, or mentioned for local prominence.

REJECT (verdict "reject"):
- Other local service companies or competitors (e.g. junk removal company homepages, "Junk Removal in City | Company Name")
- National lead-gen directories: HomeAdvisor, Thumbtack, Yelp, Angi, Yellow Pages, BBB listings, Bark, Porch
- Social media profiles without a sponsor/directory program
- Generic "best of" or "top 10" listicles
- School homepages, Wikipedia, job boards, business-for-sale marketplaces
- Company marketing pages that are NOT chambers, sponsors, directories, or community programs

KEEP (verdict "keep"):
- Chambers of commerce and business associations (member directories)
- City/county .gov business or vendor pages
- Charity, school, sports team, or community event SPONSOR pages
- HOA approved vendor lists
- Local community cleanup/recycling events seeking sponsors or partners
- Local news/blog pages about community sponsorship (not generic service lists)

Return JSON only:
{"results":[{"url":"...","verdict":"keep"|"reject","reason":"short reason","opportunityType":"chamber|local_directory|..."}]}

Valid opportunityType values: ${VALID_TYPES.join(", ")}
Do not invent URLs. Only evaluate the provided items.`;

  const userPayload = {
    business: params.context,
    items: params.batch.map((b) => ({
      url: b.url,
      title: b.title,
      domain: b.domain,
      snippet: b.snippet.slice(0, 200),
      suggestedType: b.opportunityType,
    })),
  };

  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await res.json();

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "local-trust-filter",
      request: { model: params.model, batchSize: params.batch.length },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) {
      return params.batch.map((b) => ({
        url: b.url,
        verdict: "keep" as const,
        reason: "LLM batch failed — deferred to page verification",
      }));
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return params.batch.map((b) => ({
        url: b.url,
        verdict: "keep" as const,
        reason: "Empty LLM response — deferred to page verification",
      }));
    }

    const parsed = JSON.parse(content) as {
      results?: Array<{
        url?: string;
        verdict?: string;
        reason?: string;
        opportunityType?: string;
      }>;
    };

    const byUrl = new Map<string, LlmFilterVerdict>();
    for (const r of parsed.results ?? []) {
      if (!r.url) continue;
      const verdict = r.verdict === "keep" ? "keep" : "reject";
      const opportunityType = VALID_TYPES.includes(r.opportunityType as OpportunityType)
        ? (r.opportunityType as OpportunityType)
        : undefined;
      byUrl.set(r.url, {
        url: r.url,
        verdict,
        reason: r.reason ?? (verdict === "keep" ? "Approved by LLM" : "Rejected by LLM"),
        opportunityType,
      });
    }

    return params.batch.map((b) =>
      byUrl.get(b.url) ?? {
        url: b.url,
        verdict: "keep" as const,
        reason: "Not returned by LLM — deferred to page verification",
      }
    );
  } catch (err) {
    console.error("[local-trust-filter] LLM batch error:", err);
    return params.batch.map((b) => {
      const hay = `${b.title} ${b.snippet} ${b.domain}`;
      const strictKeep = hasTrustSignals(hay);
      return {
        url: b.url,
        verdict: strictKeep ? ("keep" as const) : ("reject" as const),
        reason: strictKeep ? "LLM unavailable — kept (trust signals present)" : "LLM unavailable — rejected (no trust signals)",
      };
    });
  }
}
