import { buildMapsLiveRequest, mapsLiveRequestBody } from "@/lib/providers/dataforseo/build-maps-request";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import {
  dataForSeoGet,
  dataForSeoRequest,
  isDataForSeoQueueStatus,
  logProviderRun,
  type ProviderRunLog,
} from "@/lib/providers/dataforseo/client";
import {
  mapsPriorityGridCell,
  normalizeMapsSerpItems,
} from "@/lib/providers/dataforseo/maps-priority-batch";

export { normalizeMapsSerpItems };

export function mapsDepthDefault(): number {
  const env = Number(process.env.DATAFORSEO_MAPS_DEPTH ?? LOCAL_FALCON_PARITY.gridDepth);
  return Number.isFinite(env) && env > 0 ? Math.min(env, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
export type { TargetMatchResult, TargetMatchInput } from "@/lib/providers/dataforseo/match-target";

export type { ProviderRunLog };
export { logProviderRun, dataForSeoRequest, dataForSeoGet, isDataForSeoQueueStatus };

export interface MapsLiveResult {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  original_title?: string | null;
  url?: string | null;
  contact_url?: string | null;
  contributor_url?: string | null;
  book_online_url?: string | null;
  rating?: { rating_type?: string; value?: number; votes_count?: number; rating_max?: number } | null;
  rating_distribution?: Record<string, number> | null;
  snippet?: string | null;
  address?: string | null;
  address_info?: {
    borough?: string | null;
    address?: string | null;
    city?: string | null;
    zip?: string | null;
    region?: string | null;
    country_code?: string | null;
  } | null;
  place_id?: string;
  phone?: string | null;
  main_image?: string | null;
  total_photos?: number | null;
  category?: string | null;
  additional_categories?: string[] | null;
  category_ids?: string[] | null;
  work_hours?: unknown;
  feature_id?: string | null;
  cid?: string;
  latitude?: number;
  longitude?: number;
  is_claimed?: boolean | null;
  local_justifications?: unknown[] | null;
  is_directory_item?: boolean | null;
  price_level?: string | null;
  hotel_rating?: number | null;
}

export interface MapsLiveResponse {
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    data?: { tag?: string };
    result?: Array<{
      keyword?: string;
      check_url?: string;
      datetime?: string;
      items?: MapsLiveResult[];
    }>;
  }>;
}

export async function mapsLiveAdvanced(params: {
  keyword: string;
  lat: number;
  lng: number;
  languageCode?: string;
  device?: string;
  os?: string;
  browser?: string;
  depth?: number;
  searchThisArea?: boolean;
  searchPlaces?: boolean;
  seDomain?: string;
  zoom?: number;
  usedSearchThisAreaFallback?: boolean;
  organizationId?: string;
}): Promise<{
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: ReturnType<typeof buildMapsLiveRequest>;
}> {
  const profile = {
    device: (params.device === "mobile" ? "mobile" : "desktop") as "mobile" | "desktop",
    os: (params.os ?? DEFAULT_SCAN_PROFILE.os) as "android" | "ios" | "windows" | "macos",
    browser: (params.browser === "firefox" ? "firefox" : "chrome") as "chrome" | "firefox",
  };
  const request = buildMapsLiveRequest({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    profile,
    depth: params.depth,
    languageCode: params.languageCode,
    zoom: params.zoom,
    searchThisArea: params.searchThisArea,
    searchPlaces: params.searchPlaces,
    seDomain: params.seDomain,
    usedSearchThisAreaFallback: params.usedSearchThisAreaFallback,
  });

  const data = await dataForSeoRequest<MapsLiveResponse>(
    request._meta.endpoint,
    mapsLiveRequestBody(request),
    params.organizationId
  );

  const task = data.tasks?.[0];
  const result = task?.result?.[0];
  return {
    items: normalizeMapsSerpItems(result?.items),
    checkUrl: result?.check_url,
    timestamp: result?.datetime,
    request,
  };
}

/**
 * Grid cell fetch via DataForSEO Priority (queued task_post + task_get).
 * Uses search_this_area=false (full pack) and rejects packs with fewer than `depth` items.
 * Prefer runMapsPriorityBatch for full grids (submit all pins in one POST).
 */
export async function mapsLiveGridCell(
  params: Parameters<typeof mapsLiveAdvanced>[0]
): Promise<ReturnType<typeof mapsLiveAdvanced>> {
  const priority = await mapsPriorityGridCell({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    languageCode: params.languageCode,
    device: params.device,
    os: params.os,
    browser: params.browser,
    depth: params.depth ?? mapsDepthDefault(),
    zoom: params.zoom,
    organizationId: params.organizationId,
  });
  return {
    items: priority.items,
    checkUrl: priority.checkUrl,
    timestamp: priority.timestamp,
    // Priority adds `priority` on the stored request; Live shape remains compatible.
    request: priority.request as ReturnType<typeof buildMapsLiveRequest>,
  };
}

export interface BusinessInfoItem {
  title?: string;
  place_id?: string;
  cid?: string;
  category?: string;
  additional_categories?: string[];
  address?: string;
  phone?: string;
  url?: string;
  rating?: { value?: number; votes_count?: number };
  latitude?: number;
  longitude?: number;
  description?: string;
  attributes?: unknown;
  place_topics?: unknown;
  work_time?: unknown;
  is_claimed?: boolean;
}

export async function myBusinessInfo(params: {
  keyword: string;
  locationName?: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeId?: string | null;
  cid?: string | null;
  organizationId?: string;
}): Promise<BusinessInfoItem[]> {
  let keyword = params.keyword.trim();
  if (params.cid) {
    keyword = params.cid.startsWith("cid:") ? params.cid : `cid:${params.cid}`;
  } else if (params.placeId) {
    keyword = params.placeId;
  }

  const payload: Record<string, string> = {
    keyword,
    language_code: "en",
  };

  const usesDirectId = Boolean(params.cid || params.placeId);

  if (params.lat != null && params.lng != null) {
    payload.location_coordinate = `${params.lat},${params.lng},5000`;
  } else if (!usesDirectId) {
    const city = params.city ?? params.locationName;
    const state = params.state;
    const country = params.country ?? "United States";
    if (city && state) {
      payload.location_name = `${city},${state},${country}`;
    } else if (city?.includes(",")) {
      payload.location_name = city;
    } else if (state) {
      payload.location_name = `${city ?? state},${state},${country}`;
    } else {
      payload.location_name = country;
    }
  }

  const data = await dataForSeoRequest<{
    tasks?: Array<{ result?: Array<{ items?: BusinessInfoItem[] }> }>;
  }>("business_data/google/my_business_info/live", payload, params.organizationId);
  return data.tasks?.[0]?.result?.[0]?.items ?? [];
}

export async function taskPostMaps(params: {
  tasks: Array<{
    keyword: string;
    lat: number;
    lng: number;
    postbackUrl?: string;
    tag?: string;
    depth?: number;
    device?: string;
    os?: string;
  }>;
  organizationId?: string;
  /** 2 = high/Priority (default for grids). */
  priority?: number;
}): Promise<string[]> {
  const priority = params.priority ?? 2;
  const payload = params.tasks.map((t) => {
    const profile = {
      device: (t.device === "desktop" ? "desktop" : "mobile") as "mobile" | "desktop",
      os: (t.os ?? DEFAULT_SCAN_PROFILE.os) as "android" | "ios" | "windows" | "macos",
      browser: DEFAULT_SCAN_PROFILE.browser,
    };
    const request = buildMapsLiveRequest({
      keyword: t.keyword,
      lat: t.lat,
      lng: t.lng,
      profile,
      depth: t.depth ?? mapsDepthDefault(),
      searchThisArea: LOCAL_FALCON_PARITY.searchThisArea,
    });
    const task: Record<string, unknown> = {
      ...mapsLiveRequestBody(request),
      priority,
      tag: t.tag,
    };
    if (t.postbackUrl) task.postback_url = t.postbackUrl;
    return task;
  });

  const data = await dataForSeoRequest<{
    tasks?: Array<{ id?: string }>;
  }>("serp/google/maps/task_post", payload, params.organizationId);

  return (data.tasks ?? []).map((t) => t.id ?? "").filter(Boolean);
}

export async function googleReviews(params: {
  placeId: string;
  depth?: number;
  organizationId?: string;
}): Promise<unknown[]> {
  const depth = Math.min(params.depth ?? 10, 30);
  const data = await dataForSeoRequest<{
    tasks?: Array<{ result?: Array<{ items?: unknown[] }> }>;
  }>(
    "business_data/google/reviews/task_post",
    {
      place_id: params.placeId,
      depth,
      language_code: "en",
    },
    params.organizationId
  );
  return data.tasks?.[0]?.result?.[0]?.items ?? [];
}

export interface GoogleReviewsLiveResult {
  items: unknown[];
  timedOut: boolean;
  lastStatus?: number;
  attempts: number;
}

export async function googleReviewsLive(params: {
  placeId?: string | null;
  cid?: string | null;
  keyword?: string;
  locationCoordinate?: string;
  depth?: number;
  organizationId?: string;
}): Promise<GoogleReviewsLiveResult> {
  const payload: Record<string, unknown> = {
    depth: Math.min(params.depth ?? 50, 100),
    language_code: "en",
    sort_by: "newest",
  };

  if (params.placeId) payload.place_id = params.placeId;
  else if (params.cid) {
    const c = params.cid.replace(/^cid:/, "");
    if (/^\d+$/.test(c)) payload.cid = c;
    else payload.keyword = c.includes(":") ? `cid:${c}` : c;
  } else if (params.keyword) {
    payload.keyword = params.keyword;
  }

  if (params.locationCoordinate) payload.location_coordinate = params.locationCoordinate;
  else payload.location_name = "United States";

  const post = await dataForSeoRequest<{ tasks?: Array<{ id?: string }> }>(
    "business_data/google/reviews/task_post",
    payload,
    params.organizationId
  );
  const taskId = post.tasks?.[0]?.id;
  if (!taskId) return { items: [], timedOut: false, attempts: 0 };

  const maxAttempts = 45;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));

    const result = await dataForSeoGet<{
      tasks?: Array<{
        status_code?: number;
        result?: Array<{ items?: unknown[] }>;
      }>;
    }>(`business_data/google/reviews/task_get/${taskId}`, params.organizationId, { quietQueue: true });

    const task = result.tasks?.[0];
    const items = task?.result?.[0]?.items;
    if (items?.length) {
      return { items, timedOut: false, lastStatus: task?.status_code, attempts: attempt + 1 };
    }

    lastStatus = task?.status_code;
    if (lastStatus != null && lastStatus >= 40000 && !isDataForSeoQueueStatus(lastStatus)) {
      console.error("[DataForSEO] Reviews task failed:", { taskId, status: lastStatus, attempt: attempt + 1 });
      break;
    }
  }

  console.error("[DataForSEO] Reviews task timed out:", { taskId, lastStatus, maxAttempts });
  return { items: [], timedOut: true, lastStatus, attempts: maxAttempts };
}

export async function getMapsTaskResult(taskId: string, organizationId?: string) {
  return dataForSeoGet<MapsLiveResponse>(
    `serp/google/maps/task_get/advanced/${taskId}`,
    organizationId,
    { quietQueue: true }
  );
}

/** Persist the full useful Maps listing payload for the SERP side panel. */
export function extractTopCompetitors(items: MapsLiveResult[], limit = 100) {
  return items.slice(0, limit).map((item, idx) => ({
    rank: item.rank_group ?? item.rank_absolute ?? idx + 1,
    name: item.title ?? undefined,
    original_title: item.original_title ?? undefined,
    cid: item.cid ?? undefined,
    place_id: item.place_id ?? undefined,
    feature_id: item.feature_id ?? undefined,
    rating: item.rating?.value ?? undefined,
    review_count: item.rating?.votes_count ?? undefined,
    rating_distribution: item.rating_distribution ?? undefined,
    category: item.category ?? undefined,
    additional_categories: item.additional_categories?.length
      ? item.additional_categories
      : undefined,
    category_ids: item.category_ids?.length ? item.category_ids : undefined,
    address: item.address ?? item.snippet ?? undefined,
    snippet: item.snippet ?? undefined,
    address_info: item.address_info ?? undefined,
    phone: item.phone ?? undefined,
    url: item.url ?? undefined,
    domain: item.domain ?? undefined,
    contact_url: item.contact_url ?? undefined,
    book_online_url: item.book_online_url ?? undefined,
    main_image: item.main_image ?? undefined,
    total_photos: item.total_photos ?? undefined,
    lat: item.latitude ?? undefined,
    lng: item.longitude ?? undefined,
    is_claimed: item.is_claimed ?? undefined,
    price_level: item.price_level ?? undefined,
    hotel_rating: item.hotel_rating ?? undefined,
    work_hours: item.work_hours ?? undefined,
    local_justifications: item.local_justifications ?? undefined,
  }));
}
