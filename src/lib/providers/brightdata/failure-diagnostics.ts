/**
 * Normalized Bright Data Maps failure classification + safe diagnostics.
 * Does not change retry / concurrency policy — only makes failures observable.
 */

export const BRIGHTDATA_FAILURE_CATEGORIES = [
  "http_error",
  "provider_timeout",
  "empty_body",
  "invalid_json",
  "unexpected_schema",
  "google_consent_page",
  "google_challenge",
  "provider_error_payload",
  "empty_maps_results",
  "sparse_maps_results",
  "html_or_wrong_zone",
  "capacity_timeout",
  "circuit_open",
  "unknown",
] as const;

export type BrightDataFailureCategory = (typeof BRIGHTDATA_FAILURE_CATEGORIES)[number];

export type BrightDataBodyMarkers = {
  consent: boolean;
  captcha: boolean;
  unusualTraffic: boolean;
  signIn: boolean;
  mapsMarkers: boolean;
};

export type BrightDataFailureDiagnostics = {
  category: BrightDataFailureCategory;
  httpStatus?: number | null;
  contentType?: string | null;
  byteCount?: number | null;
  /** Bright Data / CDN request id when present on response headers. */
  requestId?: string | null;
  schemaKeys?: string[] | null;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
  /** Redacted body preview (never credentials / cookies / auth). */
  bodyPreviewRedacted?: string | null;
  markers?: BrightDataBodyMarkers;
  latencyMs?: number | null;
  zone?: string | null;
  organicCount?: number | null;
  /** Bright Data troubleshooting headers (x-brd-error*, x-luminati-error*). */
  responseHeaders?: Record<string, string> | null;
};

const REDACT_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]"],
  [/Authorization["']?\s*[:=]\s*["']?[^"'\\s]+/gi, "Authorization:[REDACTED]"],
  [/api[_-]?key["']?\s*[:=]\s*["']?[^"'\\s]+/gi, "api_key:[REDACTED]"],
  [/password["']?\s*[:=]\s*["']?[^"'\\s]+/gi, "password:[REDACTED]"],
  [/cookie["']?\s*[:=]\s*["']?[^"'\\n]+/gi, "cookie:[REDACTED]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]"],
  [/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
];

export function redactProviderText(input: string, maxChars = 800): string {
  let out = input.replace(/\0/g, "");
  for (const [re, replacement] of REDACT_PATTERNS) {
    out = out.replace(re, replacement);
  }
  if (out.length > maxChars) {
    return `${out.slice(0, maxChars)}…`;
  }
  return out;
}

export function detectBodyMarkers(text: string): BrightDataBodyMarkers {
  const lower = text.toLowerCase();
  return {
    consent:
      lower.includes("consent.google") ||
      lower.includes("before you continue") ||
      lower.includes("we use cookies") ||
      lower.includes("lso/intermediate") ||
      (lower.includes("consent") && lower.includes("google")),
    captcha:
      lower.includes("captcha") ||
      lower.includes("recaptcha") ||
      lower.includes("g-recaptcha") ||
      lower.includes("/sorry/"),
    unusualTraffic:
      lower.includes("unusual traffic") ||
      lower.includes("automated queries") ||
      lower.includes("detected unusual"),
    signIn:
      lower.includes("accounts.google.com") ||
      lower.includes("sign in to continue") ||
      lower.includes("serviceLogin".toLowerCase()),
    mapsMarkers:
      lower.includes("google.com/maps") ||
      lower.includes("maps/preview") ||
      lower.includes("maps/place") ||
      lower.includes('"organic"') ||
      lower.includes("local pack"),
  };
}

export function topLevelSchemaKeys(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  if (Array.isArray(parsed)) return ["[array]"];
  return Object.keys(parsed as Record<string, unknown>).slice(0, 40);
}

/** Bright Data cookie-pool miss — retry, do not treat as a completed Maps lookup. */
export function isNoReadyCookies(
  code?: string | null,
  message?: string | null,
  bodyText?: string | null
): boolean {
  const blob = `${code ?? ""} ${message ?? ""} ${bodyText ?? ""}`.toLowerCase();
  return (
    blob.includes("no_ready_cookies") ||
    blob.includes("no ready cookies") ||
    blob.includes("noreadycookies")
  );
}

function extractProviderError(parsed: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { code: null, message: null };
  }
  const o = parsed as Record<string, unknown>;
  const code =
    o.code != null
      ? String(o.code)
      : o.error_code != null
        ? String(o.error_code)
        : o.status_code != null
          ? String(o.status_code)
          : null;
  let message: string | null = null;
  if (typeof o.error === "string") message = o.error;
  else if (o.error && typeof o.error === "object" && "message" in (o.error as object)) {
    message = String((o.error as { message?: unknown }).message ?? "");
  } else if (typeof o.message === "string") message = o.message;
  else if (typeof o.detail === "string") message = o.detail;
  return { code, message: message ? message.slice(0, 300) : null };
}

function categoryFromMarkers(markers: BrightDataBodyMarkers): BrightDataFailureCategory | null {
  if (markers.consent) return "google_consent_page";
  if (markers.captcha || markers.unusualTraffic) return "google_challenge";
  if (markers.signIn) return "google_challenge";
  return null;
}

export function humanMessageForCategory(
  category: BrightDataFailureCategory,
  extras?: { status?: number; detail?: string; zone?: string; organicCount?: number; minRequired?: number }
): string {
  switch (category) {
    case "http_error":
      return `Bright Data SERP HTTP ${extras?.status ?? "?"}: ${extras?.detail ?? "request failed"}`;
    case "provider_timeout":
      return extras?.detail ?? "brightdata timeout";
    case "empty_body":
      return "Bright Data returned an empty body for this cell";
    case "invalid_json":
      return "Bright Data returned invalid JSON for this cell";
    case "unexpected_schema":
      return "Bright Data returned an unexpected Maps response schema";
    case "google_consent_page":
      return "Bright Data returned a Google consent page instead of Maps results";
    case "google_challenge":
      return "Bright Data returned a Google challenge / unusual-traffic page";
    case "provider_error_payload":
      return `Bright Data provider error: ${extras?.detail ?? "unknown"}`;
    case "empty_maps_results":
      // Keep legacy substring so existing retry heuristics still match.
      return "Bright Data returned no map results for this cell";
    case "sparse_maps_results":
      return extras?.detail ??
        `sparse SERP: ${extras?.organicCount ?? 0} results returned (need ${extras?.minRequired ?? 3})`;
    case "html_or_wrong_zone":
      return `Bright Data zone "${extras?.zone ?? "?"}" returned HTML, not ranked Maps JSON — create a SERP API zone at https://brightdata.com/cp/zones`;
    case "capacity_timeout":
      return (
        extras?.detail ??
        "Bright Data cookie pool / capacity not ready (no_ready_cookies) — retry, not a Maps miss"
      );
    case "circuit_open":
      return extras?.detail ?? "brightdata circuit open";
    default:
      return extras?.detail ?? "Bright Data Maps request failed";
  }
}

/**
 * Classify a completed Bright Data HTTP response that did not yield usable organic results.
 */
export function classifyBrightDataMapsResponse(params: {
  httpStatus: number;
  contentType?: string | null;
  bodyText: string;
  latencyMs: number;
  zone?: string | null;
  requestId?: string | null;
  organicCount?: number;
  responseHeaders?: Record<string, string> | null;
}): BrightDataFailureDiagnostics {
  const bodyText = params.bodyText ?? "";
  const byteCount = new TextEncoder().encode(bodyText).length;
  const markers = detectBodyMarkers(bodyText);
  const preview = redactProviderText(bodyText, 800);
  const trimmed = bodyText.trim();
  const headerCode =
    params.responseHeaders?.["x-brd-error-code"] ??
    params.responseHeaders?.["x-luminati-error-code"] ??
    null;
  const headerMsg =
    params.responseHeaders?.["x-brd-error"] ??
    params.responseHeaders?.["x-luminati-error"] ??
    params.responseHeaders?.["x-luminati-error-msg"] ??
    null;

  const base = {
    httpStatus: params.httpStatus,
    contentType: params.contentType ?? null,
    byteCount,
    requestId: params.requestId ?? null,
    bodyPreviewRedacted: preview || null,
    markers,
    latencyMs: params.latencyMs,
    zone: params.zone ?? null,
    organicCount: params.organicCount ?? null,
    responseHeaders: params.responseHeaders ?? null,
  };

  if (!params.httpStatus || params.httpStatus < 200 || params.httpStatus >= 300) {
    let parsed: unknown = null;
    try {
      parsed = trimmed ? JSON.parse(trimmed) : null;
    } catch {
      parsed = null;
    }
    const err = extractProviderError(parsed);
    const code = headerCode ?? err.code;
    const message =
      headerMsg ??
      err.message ??
      (params.httpStatus === 503
        ? "Service Unavailable — Bright Data browser check failed or incomplete; retry (confirm zone is SERP API, not Web Unlocker)"
        : null);
    // Cookie-pool / capacity misses are not real Maps searches — keep retrying.
    if (isNoReadyCookies(code, message, trimmed)) {
      return {
        ...base,
        category: "capacity_timeout",
        schemaKeys: topLevelSchemaKeys(parsed),
        providerErrorCode: code ?? "no_ready_cookies",
        providerErrorMessage:
          message ?? "no_ready_cookies — Bright Data cookie pool not ready (not a Maps miss)",
      };
    }
    return {
      ...base,
      category: "http_error",
      schemaKeys: topLevelSchemaKeys(parsed),
      providerErrorCode: code,
      providerErrorMessage: message,
    };
  }

  if (!trimmed) {
    return {
      ...base,
      category: "empty_body",
      schemaKeys: [],
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  const markerCategory = categoryFromMarkers(markers);
  const looksHtml =
    trimmed.startsWith("<!") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML") ||
    (params.contentType ?? "").toLowerCase().includes("text/html");

  if (looksHtml) {
    return {
      ...base,
      category: markerCategory ?? "html_or_wrong_zone",
      schemaKeys: ["[html]"],
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ...base,
      category: markerCategory ?? "invalid_json",
      schemaKeys: [],
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  const schemaKeys = topLevelSchemaKeys(parsed);
  const err = extractProviderError(parsed);
  if (err.message || err.code) {
    const hasOrganic =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as { organic?: unknown }).organic) &&
      ((parsed as { organic: unknown[] }).organic?.length ?? 0) > 0;
    if (!hasOrganic) {
      if (isNoReadyCookies(err.code, err.message, trimmed) || isNoReadyCookies(headerCode, headerMsg)) {
        return {
          ...base,
          category: "capacity_timeout",
          schemaKeys,
          providerErrorCode: err.code ?? headerCode ?? "no_ready_cookies",
          providerErrorMessage:
            err.message ??
            headerMsg ??
            "no_ready_cookies — Bright Data cookie pool not ready (not a Maps miss)",
        };
      }
      return {
        ...base,
        category: "provider_error_payload",
        schemaKeys,
        providerErrorCode: err.code,
        providerErrorMessage: err.message,
      };
    }
  }

  if (markerCategory) {
    return {
      ...base,
      category: markerCategory,
      schemaKeys,
      providerErrorCode: err.code,
      providerErrorMessage: err.message,
    };
  }

  const organicCount = params.organicCount ?? 0;
  if (organicCount === 0) {
    const expectedKeys = new Set(["organic", "place", "body"]);
    const hasExpected = schemaKeys.some((k) => expectedKeys.has(k) || k === "[array]");
    return {
      ...base,
      category: hasExpected || schemaKeys.length === 0 ? "empty_maps_results" : "unexpected_schema",
      schemaKeys,
      providerErrorCode: err.code,
      providerErrorMessage: err.message,
    };
  }

  return {
    ...base,
    category: "empty_maps_results",
    schemaKeys,
    providerErrorCode: err.code,
    providerErrorMessage: err.message,
  };
}

export class BrightDataMapsFailure extends Error {
  readonly category: BrightDataFailureCategory;
  readonly diagnostics: BrightDataFailureDiagnostics;

  constructor(diagnostics: BrightDataFailureDiagnostics, message?: string) {
    super(
      message ??
        humanMessageForCategory(diagnostics.category, {
          status: diagnostics.httpStatus ?? undefined,
          detail: diagnostics.providerErrorMessage ?? undefined,
          zone: diagnostics.zone ?? undefined,
          organicCount: diagnostics.organicCount ?? undefined,
        })
    );
    this.name = "BrightDataMapsFailure";
    this.category = diagnostics.category;
    this.diagnostics = diagnostics;
  }
}

export function extractBrightDataRequestId(headers: Headers): string | null {
  const keys = [
    "x-request-id",
    "x-brd-request-id",
    "x-brightdata-request-id",
    "cf-ray",
    "x-amzn-requestid",
  ];
  for (const key of keys) {
    const v = headers.get(key);
    if (v?.trim()) return v.trim().slice(0, 120);
  }
  return null;
}

/**
 * Capture Bright Data error / throttle headers for support tickets.
 * Sophie / BD docs: check x-brd-error-code, x-brd-error, x-luminati-*.
 */
export function extractBrightDataErrorHeaders(
  headers: Headers
): Record<string, string> | null {
  const keys = [
    "x-brd-error-code",
    "x-brd-error",
    "x-luminati-error-code",
    "x-luminati-error",
    "x-luminati-error-msg",
    "retry-after",
  ];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = headers.get(key);
    if (v?.trim()) out[key] = v.trim().slice(0, 240);
  }
  return Object.keys(out).length ? out : null;
}

/** Safe object for DB / console — never includes auth material. */
export function diagnosticsForStorage(
  diagnostics: BrightDataFailureDiagnostics
): Record<string, unknown> {
  return {
    category: diagnostics.category,
    http_status: diagnostics.httpStatus ?? null,
    content_type: diagnostics.contentType ?? null,
    byte_count: diagnostics.byteCount ?? null,
    request_id: diagnostics.requestId ?? null,
    schema_keys: diagnostics.schemaKeys ?? null,
    provider_error_code: diagnostics.providerErrorCode ?? null,
    provider_error_message: diagnostics.providerErrorMessage
      ? redactProviderText(diagnostics.providerErrorMessage, 300)
      : null,
    body_preview_redacted: diagnostics.bodyPreviewRedacted
      ? redactProviderText(diagnostics.bodyPreviewRedacted, 800)
      : null,
    markers: diagnostics.markers ?? null,
    latency_ms: diagnostics.latencyMs ?? null,
    zone: diagnostics.zone ?? null,
    organic_count: diagnostics.organicCount ?? null,
    response_headers: diagnostics.responseHeaders ?? null,
  };
}

export function logBrightDataFailureDiagnostics(
  context: string,
  diagnostics: BrightDataFailureDiagnostics
): void {
  console.warn(
    `[BrightDataMaps] ${context} category=${diagnostics.category}` +
      ` http=${diagnostics.httpStatus ?? "-"}` +
      ` latencyMs=${diagnostics.latencyMs ?? "-"}` +
      ` bytes=${diagnostics.byteCount ?? "-"}` +
      ` requestId=${diagnostics.requestId ?? "-"}` +
      ` zone=${diagnostics.zone ?? "-"}` +
      ` brdCode=${diagnostics.providerErrorCode ?? "-"}` +
      ` keys=${(diagnostics.schemaKeys ?? []).join(",") || "-"}` +
      ` markers=${diagnostics.markers ? JSON.stringify(diagnostics.markers) : "-"}` +
      (diagnostics.responseHeaders
        ? ` headers=${JSON.stringify(diagnostics.responseHeaders)}`
        : "") +
      (diagnostics.providerErrorMessage
        ? ` err=${redactProviderText(diagnostics.providerErrorMessage, 160)}`
        : "")
  );
  if (diagnostics.bodyPreviewRedacted) {
    console.warn(
      `[BrightDataMaps] ${context} bodyPreview=${diagnostics.bodyPreviewRedacted}`
    );
  }
}

export function failureFromUnknownError(
  err: unknown,
  extras?: Partial<BrightDataFailureDiagnostics>
): BrightDataMapsFailure {
  if (err instanceof BrightDataMapsFailure) {
    if (!extras) return err;
    return new BrightDataMapsFailure(
      { ...err.diagnostics, ...extras, category: extras.category ?? err.category },
      err.message
    );
  }

  const msg = err instanceof Error ? err.message : String(err ?? "unknown");
  const lower = msg.toLowerCase();
  let category: BrightDataFailureCategory = "unknown";
  if (lower.includes("capacity timeout")) category = "capacity_timeout";
  else if (lower.includes("timeout")) category = "provider_timeout";
  else if (lower.includes("circuit open")) category = "circuit_open";
  else if (lower.includes("consent")) category = "google_consent_page";
  else if (lower.includes("challenge") || lower.includes("unusual-traffic")) category = "google_challenge";
  else if (lower.includes("http ")) category = "http_error";
  else if (lower.includes("no map results") || lower.includes("empty")) category = "empty_maps_results";
  else if (lower.includes("sparse serp") || lower.includes("target-only")) category = "sparse_maps_results";
  else if (lower.includes("html, not ranked")) category = "html_or_wrong_zone";

  return new BrightDataMapsFailure(
    {
      latencyMs: extras?.latencyMs ?? null,
      httpStatus: extras?.httpStatus ?? null,
      contentType: extras?.contentType ?? null,
      byteCount: extras?.byteCount ?? null,
      requestId: extras?.requestId ?? null,
      schemaKeys: extras?.schemaKeys ?? null,
      providerErrorMessage: msg.slice(0, 300),
      zone: extras?.zone ?? null,
      markers: extras?.markers,
      ...extras,
      category: extras?.category ?? category,
    },
    msg
  );
}
