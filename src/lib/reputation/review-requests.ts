import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import {
  fallbackReviewRequestTemplates,
  generateReviewRequestTemplates,
} from "@/lib/providers/deepseek/reputation";
import { renderTemplate } from "@/lib/reputation/template-vars";
import {
  DEFAULT_POSTER_CONFIG,
  parsePosterConfig,
  type PosterConfig,
} from "@/lib/reputation/poster-config";

export { renderTemplate };
export {
  DEFAULT_POSTER_CONFIG,
  POSTER_BRAND_COLORS,
  parsePosterConfig,
  type PosterConfig,
} from "@/lib/reputation/poster-config";

export function buildGoogleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function buildMapsFallbackUrl(params: {
  placeId?: string | null;
  cid?: string | null;
  name?: string | null;
}): string | null {
  if (params.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=place_id:${encodeURIComponent(params.placeId)}`;
  }
  if (params.cid) {
    return `https://www.google.com/maps?cid=${encodeURIComponent(params.cid)}`;
  }
  if (params.name) {
    return `https://www.google.com/maps/search/${encodeURIComponent(params.name)}`;
  }
  return null;
}

export function slugFromBusinessName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "review";
}


const DEFAULT_SMS = `Hey {{customer_name}}, thanks again for choosing {{business_name}}. Would you mind leaving us a quick Google review? It helps local customers find us. Here's the link: {{review_link}}`;

const DEFAULT_SMS_KEYWORD = `Hey {{customer_name}}, thanks again for choosing {{business_name}} for your {{service_type}}. If you have a minute, could you leave us a quick Google review and mention what we helped with? Here's the link: {{review_link}}`;

const DEFAULT_EMAIL_SUBJECT = `Quick favor — Google review for {{business_name}}`;

const DEFAULT_EMAIL = `Hi {{customer_name}},

Thank you for choosing {{business_name}}. If you had a good experience, we'd really appreciate a quick Google review. It helps neighbors find us when they need help.

{{review_link}}

Thanks again,
{{business_name}}`;

const DEFAULT_GENERIC = `Thank you for your business! If you're happy with our work, please leave us a Google review: {{review_link}}`;

async function seedDefaultTemplates(params: {
  organizationId: string;
  businessId: string;
  businessName: string;
  reviewUrl: string;
  keywordFocus?: string | null;
}) {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("review_request_templates")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId);

  if ((count ?? 0) > 0) return;

  const rows = [
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "sms",
      name: "Standard SMS",
      body: DEFAULT_SMS,
      is_default: true,
      tone: "friendly",
    },
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "sms",
      name: "SMS with service mention",
      body: DEFAULT_SMS_KEYWORD,
      service_keyword_focus: params.keywordFocus,
      is_default: false,
      tone: "friendly",
    },
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "email",
      name: "Standard email",
      subject: DEFAULT_EMAIL_SUBJECT,
      body: DEFAULT_EMAIL,
      is_default: true,
      tone: "friendly",
    },
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "generic",
      name: "Generic",
      body: DEFAULT_GENERIC,
      is_default: true,
      tone: "friendly",
    },
  ];

  const { error } = await supabase.from("review_request_templates").insert(rows);
  if (error) throw new Error(`Failed to seed review templates: ${error.message}`);
}

export async function createOrRefreshReviewLink(params: {
  businessId: string;
  organizationId: string;
  forceRefresh?: boolean;
}) {
  const business = await getBusiness(params.businessId, params.organizationId);
  if (!business) throw new Error("Business not found");

  const placeId = business.place_id;
  if (!placeId) {
    return {
      link: null,
      warning: "Place ID missing. Run GBP enrichment first.",
      mapsFallbackUrl: buildMapsFallbackUrl({
        placeId: null,
        cid: business.cid,
        name: business.name,
      }),
      businessName: business.name,
    };
  }

  const reviewUrl = buildGoogleReviewUrl(placeId);
  const supabase = createServiceClient();

  if (!params.forceRefresh) {
    const { data: existing } = await supabase
      .from("review_request_links")
      .select("*")
      .eq("business_id", params.businessId)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      await seedDefaultTemplates({
        organizationId: params.organizationId,
        businessId: params.businessId,
        businessName: business.name,
        reviewUrl,
      });
      return {
        link: existing,
        warning: null,
        mapsFallbackUrl: buildMapsFallbackUrl({
          placeId,
          cid: business.cid,
          name: business.name,
        }),
        businessName: business.name,
      };
    }
  } else {
    await supabase
      .from("review_request_links")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("business_id", params.businessId)
      .eq("is_active", true);
  }

  const slug = slugFromBusinessName(business.name);
  const { data: link, error } = await supabase
    .from("review_request_links")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      place_id: placeId,
      review_url: reviewUrl,
      short_url: slug,
      poster_config: DEFAULT_POSTER_CONFIG,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await seedDefaultTemplates({
    organizationId: params.organizationId,
    businessId: params.businessId,
    businessName: business.name,
    reviewUrl,
  });

  return {
    link,
    warning: null,
    mapsFallbackUrl: buildMapsFallbackUrl({
      placeId,
      cid: business.cid,
      name: business.name,
    }),
    businessName: business.name,
  };
}

export async function loadReviewRequestKit(businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const business = await getBusiness(businessId, organizationId);

  const [linkRes, templatesRes, eventsRes, keywordGapsRes] = await Promise.all([
    supabase
      .from("review_request_links")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("review_request_templates")
      .select("*")
      .eq("business_id", businessId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("review_request_events")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("review_keyword_gaps")
      .select("id, keyword, keyword_type, gap, priority, recommendation")
      .eq("business_id", businessId)
      .order("gap", { ascending: false })
      .limit(20),
  ]);

  const placeId = business?.place_id ?? linkRes.data?.place_id ?? null;
  const keywordSuggestions = dedupeKeywordSuggestions(
    (keywordGapsRes.data ?? []).filter((g) => Number(g.gap) > 0)
  ).slice(0, 12);

  const link = linkRes.data;
  const posterConfig = parsePosterConfig(link?.poster_config);
  const businessName = business?.name ?? "";

  if (link && !link.short_url && businessName) {
    const slug = slugFromBusinessName(businessName);
    await supabase
      .from("review_request_links")
      .update({ short_url: slug, updated_at: new Date().toISOString() })
      .eq("id", link.id);
    link.short_url = slug;
  }

  return {
    businessName,
    placeId,
    link,
    posterConfig,
    mapsFallbackUrl: buildMapsFallbackUrl({
      placeId,
      cid: business?.cid,
      name: business?.name,
    }),
    warning: placeId ? null : "Place ID missing. Run GBP enrichment first.",
    templates: templatesRes.data ?? [],
    events: eventsRes.data ?? [],
    keywordSuggestions,
  };
}

type KeywordSuggestionRow = {
  id?: string;
  keyword: string;
  keyword_type?: string;
  gap?: number;
};

function dedupeKeywordSuggestions(rows: KeywordSuggestionRow[]): KeywordSuggestionRow[] {
  const byKeyword = new Map<string, KeywordSuggestionRow>();
  for (const row of rows) {
    const key = row.keyword.toLowerCase().trim();
    const existing = byKeyword.get(key);
    if (!existing || Number(row.gap ?? 0) > Number(existing.gap ?? 0)) {
      byKeyword.set(key, row);
    }
  }
  return Array.from(byKeyword.values()).sort((a, b) => Number(b.gap ?? 0) - Number(a.gap ?? 0));
}

export async function logReviewRequestEvent(params: {
  businessId: string;
  organizationId: string;
  linkId?: string | null;
  eventType: string;
  channel?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceType?: string | null;
  notes?: string | null;
}) {
  const supabase = createServiceClient();

  let linkId = params.linkId ?? null;
  if (linkId) {
    const { data: link } = await supabase
      .from("review_request_links")
      .select("id")
      .eq("id", linkId)
      .eq("business_id", params.businessId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();
    if (!link) throw new Error("Review link not found for this business");
  }

  const { data, error } = await supabase
    .from("review_request_events")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      link_id: linkId,
      event_type: params.eventType,
      channel: params.channel ?? null,
      customer_name: params.customerName ?? null,
      customer_phone: params.customerPhone ?? null,
      customer_email: params.customerEmail ?? null,
      service_type: params.serviceType ?? null,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function generateAndSaveTemplates(params: {
  businessId: string;
  organizationId: string;
  businessName: string;
  reviewUrl: string;
  keywordSuggestions?: string[];
  tone?: string;
}) {
  const ai =
    (await generateReviewRequestTemplates({
      businessName: params.businessName,
      reviewUrl: params.reviewUrl,
      keywordSuggestions: params.keywordSuggestions ?? [],
      tone: params.tone ?? "friendly",
      organizationId: params.organizationId,
    })) ??
    fallbackReviewRequestTemplates({
      businessName: params.businessName,
      reviewUrl: params.reviewUrl,
    });

  const supabase = createServiceClient();
  await supabase
    .from("review_request_templates")
    .update({ is_default: false })
    .eq("business_id", params.businessId);

  const rows = [
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "sms",
      name: "AI SMS",
      body: ai.sms_template,
      is_default: true,
      tone: params.tone ?? "friendly",
    },
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "email",
      name: "AI Email",
      subject: ai.email_subject,
      body: ai.email_template,
      is_default: true,
      tone: params.tone ?? "friendly",
    },
    {
      organization_id: params.organizationId,
      business_id: params.businessId,
      channel: "generic",
      name: "AI Generic",
      body: ai.generic_template,
      is_default: true,
      tone: params.tone ?? "friendly",
    },
  ];

  const { data } = await supabase.from("review_request_templates").insert(rows).select("*");
  return { templates: data ?? [], ai };
}

export async function updateReviewLinkSettings(params: {
  businessId: string;
  organizationId: string;
  shortSlug?: string;
  posterConfig?: PosterConfig;
}) {
  await getBusiness(params.businessId, params.organizationId);
  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("review_request_links")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("is_active", true)
    .maybeSingle();

  if (!link) throw new Error("No active review link. Generate one first.");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.shortSlug != null) {
    updates.short_url = slugFromBusinessName(params.shortSlug);
  }
  if (params.posterConfig) {
    updates.poster_config = params.posterConfig;
  }

  const { data, error } = await supabase
    .from("review_request_links")
    .update(updates)
    .eq("id", link.id)
    .eq("business_id", params.businessId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Failed to update review link");
  return data;
}
