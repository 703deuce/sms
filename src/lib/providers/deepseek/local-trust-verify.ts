import { callJsonLlm } from "@/lib/providers/llm-json";
import type { FetchedOpportunityPage } from "@/lib/local-trust/fetch-opportunity-page";
import {
  applyHardAcceptanceGates,
  isHighPriorityVerified,
  MIN_VERIFY_CONFIDENCE,
  MIN_VERIFY_LOCAL_RELEVANCE,
} from "@/lib/local-trust/accept-gate";
import type { OpportunityType } from "@/lib/local-trust/types";

export { MIN_VERIFY_CONFIDENCE, MIN_VERIFY_LOCAL_RELEVANCE } from "@/lib/local-trust/accept-gate";

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

export type VerifyCandidate = {
  url: string;
  title: string;
  domain: string;
  snippet: string;
  opportunityType: OpportunityType;
  page: FetchedOpportunityPage;
};

export type VerifyResult = {
  url: string;
  include: boolean;
  opportunityType?: OpportunityType;
  confidence: number;
  localRelevance: number;
  organizationName?: string;
  reason: string;
  nextAction?: string;
  actionUrl?: string;
  rejectReason?: string;
  llmProvider?: string;
  highPriority?: boolean;
};

const SYSTEM_PROMPT = `You verify local trust opportunities for a local business SEO platform.

A valid opportunity must be one of:
- sponsorship opportunity with a real organizer (school, league, event, nonprofit)
- chamber/business association membership or member directory
- local civic organization membership (Rotary, etc.) on the organization's own website
- vendor/procurement registration on an official government or school site
- cleanup/environmental partnership with a local nonprofit or county program

IMPORTANT:
- Do NOT accept platform search/listing pages (Eventeny, Meetup, Eventbrite, generic Patch articles). Only accept the official organization website or a specific event page with sponsor/vendor application details.
- Do NOT accept news articles unless they contain CURRENT sponsor tiers, contact info, or a link to the organizer's sponsorship page.
- Do NOT accept generic county/city resource pages (economic development, tourism, department homepages). Only accept direct vendor registration, procurement, or sponsorship pages.
- City name match is NOT enough. The page must clearly serve the target city AND state/county (e.g. Woodbridge, VA / Prince William County — NOT Woodbridge, NJ or Woodbridge, DE).
- Do NOT reject solely because there is no online signup form. Offline contact paths are fine on official org pages.

Reject if:
- competitor business or another local service company homepage
- top-10/listicle/lead-gen ranking page
- platform aggregator, not the actual organization
- wrong city/state (location_mismatch=true)
- page too thin to verify
- merely "potential" with no clear action path

Return JSON only:
{
  "include": true,
  "location_mismatch": false,
  "opportunity_type": "chamber",
  "confidence": 88,
  "local_relevance": 92,
  "organization_name": "Prince William Chamber of Commerce",
  "reason": "Official chamber site with membership directory for Prince William County businesses",
  "next_action": "Review membership options and list the business in the directory",
  "action_url": null,
  "reject_reason": null
}

If rejecting, set include=false, location_mismatch=true when applicable, and reject_reason to a clear explanation.
Never set include=true when reject_reason is non-null or location_mismatch=true.

Target market: the business serves the given city, county, and state. Prince William County and Woodbridge, VA are the same market.

Valid opportunity_type values: ${VALID_TYPES.join(", ")}`;

export async function verifyLocalTrustPage(params: {
  organizationId?: string;
  businessName: string;
  city: string;
  county: string;
  state: string;
  category: string;
  candidate: VerifyCandidate;
}): Promise<VerifyResult> {
  const { candidate } = params;
  const { page } = candidate;

  if (page.fetchStatus !== "ok") {
    return reject(candidate.url, `Page fetch failed (${page.fetchStatus}) — excluded`);
  }

  const userPayload = {
    target_market: {
      city: params.city,
      county: params.county,
      state: params.state,
      business_category: params.category,
      business_name: params.businessName,
    },
    candidate: {
      url: candidate.url,
      title: candidate.title,
      domain: candidate.domain,
      search_snippet: candidate.snippet.slice(0, 300),
      suggested_type: candidate.opportunityType,
      page_title: page.title,
      organization_name: page.organizationName,
      headings: page.headings,
      action_links: page.actionLinks,
      contact_hints: page.contactHints,
      page_text: page.bodyText.slice(0, 5000),
    },
  };

  try {
    const llm = await callJsonLlm({
      organizationId: params.organizationId,
      endpoint: "local-trust-verify",
      systemPrompt: SYSTEM_PROMPT,
      userContent: JSON.stringify(userPayload),
      temperature: 0.1,
    });

    if (!llm.ok || !llm.content) {
      return reject(
        candidate.url,
        `Verification LLM failed (${llm.provider}${llm.statusCode ? ` ${llm.statusCode}` : ""}: ${llm.error ?? "no response"})`
      );
    }

    const parsed = JSON.parse(llm.content) as {
      include?: boolean;
      location_mismatch?: boolean;
      opportunity_type?: string;
      confidence?: number;
      local_relevance?: number;
      organization_name?: string;
      reason?: string;
      next_action?: string;
      action_url?: string;
      reject_reason?: string;
    };

    const confidence = clampScore(parsed.confidence);
    const localRelevance = clampScore(parsed.local_relevance);
    const opportunityType = VALID_TYPES.includes(parsed.opportunity_type as OpportunityType)
      ? (parsed.opportunity_type as OpportunityType)
      : candidate.opportunityType;

    const llmInclude = parsed.include === true && !parsed.reject_reason?.trim() && parsed.location_mismatch !== true;

    const gate = applyHardAcceptanceGates({
      llmInclude,
      confidence,
      localRelevance,
      rejectReason: parsed.reject_reason,
      reason: parsed.reason,
      locationMismatch: parsed.location_mismatch === true,
      domain: candidate.domain,
      page,
      targetCity: params.city,
      targetState: params.state,
      targetCounty: params.county,
      opportunityType,
    });

    if (!gate.include) {
      return {
        url: candidate.url,
        include: false,
        confidence,
        localRelevance,
        reason: parsed.reason ?? gate.rejectReason ?? "Did not pass verification",
        rejectReason: gate.rejectReason ?? parsed.reject_reason ?? "Failed final acceptance gate",
      };
    }

    return {
      url: candidate.url,
      include: true,
      opportunityType,
      confidence,
      localRelevance,
      organizationName: parsed.organization_name ?? page.organizationName ?? undefined,
      reason: parsed.reason ?? "Verified local trust opportunity from page content",
      nextAction: parsed.next_action ?? "Review page and reach out locally",
      actionUrl: parsed.action_url || page.actionLinks[0]?.href || candidate.url,
      llmProvider: llm.provider,
      highPriority: isHighPriorityVerified(confidence, localRelevance),
    };
  } catch (err) {
    console.error("[local-trust-verify] error:", err);
    return reject(candidate.url, "Verification error — excluded");
  }
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function reject(url: string, rejectReason: string): VerifyResult {
  return {
    url,
    include: false,
    confidence: 0,
    localRelevance: 0,
    reason: rejectReason,
    rejectReason,
  };
}
