/**
 * Same-origin checks for cookie-authenticated mutating API requests.
 * Webhooks / cron / bearer-only routes should be excluded by the caller.
 *
 * Behind Coolify/Traefik, `request.url` is often an internal host (localhost /
 * container name). Browser Origin must be compared to an explicit allowlist
 * (APP_URL / NEXT_PUBLIC_APP_URL / ALLOWED_ORIGINS), never to the container URL.
 */

import { BUILTIN_PRODUCTION_ORIGINS, getAppBaseUrl } from "@/lib/app-url";

export type CsrfRequestLike = {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
};

export type SameOriginDiagnostics = {
  origin: string | null;
  refererOrigin: string | null;
  canonicalOrigin: string | null;
  allowedOrigins: string[];
  requestHost: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  path: string;
  reason: string | null;
};

export type SameOriginDecision = {
  ok: boolean;
  diagnostics: SameOriginDiagnostics;
};

/** Normalize to `scheme://host[:port]` with lowercase host and no default ports. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "*") return null;
  try {
    const raw = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const u = new URL(raw);
    const protocol = u.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return null;
    const hostname = u.hostname.toLowerCase();
    if (!hostname) return null;
    // Reject URL credentials / unexpected shapes
    if (u.username || u.password) return null;
    let port = u.port;
    if (
      (protocol === "https:" && (port === "443" || port === "")) ||
      (protocol === "http:" && (port === "80" || port === ""))
    ) {
      port = "";
    }
    const host = port ? `${hostname}:${port}` : hostname;
    return `${protocol}//${host}`;
  } catch {
    return null;
  }
}

function parsePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function parseRequestHost(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Strict allowlist of exact origins — no wildcards, no suffix matching. */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const normalized = normalizeOrigin(raw);
    if (normalized) origins.add(normalized);
  };

  add(process.env.APP_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  for (const part of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    add(part);
  }

  // Canonical helper (env → production default → localhost in dev)
  try {
    add(getAppBaseUrl());
  } catch {
    /* ignore */
  }

  // Belt-and-suspenders: if Coolify only set the legacy typo host (or left
  // APP_URL empty), browser posts from the live domain must still work.
  if (process.env.NODE_ENV === "production") {
    for (const origin of BUILTIN_PRODUCTION_ORIGINS) {
      add(origin);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");
  }

  return [...origins];
}

export function getCanonicalOrigin(): string | null {
  return (
    normalizeOrigin(process.env.APP_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(getAppBaseUrl())
  );
}

/**
 * Build an origin from forwarded proto/host only for diagnostics and for
 * confirming the proxy saw our allowlisted host. Never expands the allowlist.
 */
export function originFromForwardedHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? null;
  const forwardedProto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ?? null;
  if (!forwardedHost || !forwardedProto) return null;
  if (forwardedProto !== "http" && forwardedProto !== "https") return null;
  if (/[\s/\\]/.test(forwardedHost)) return null;
  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

/** Module dashboard Run buttons — cookie-authenticated POSTs that must pass CSRF. */
export const MODULE_RUN_ENDPOINTS = [
  "/api/reviews/momentum/run",
  "/api/trust/run",
  "/api/growth-audit/run",
  "/api/backlink-gap/run",
  "/api/ai-visibility/run",
  "/api/citations/run",
  "/api/reputation/run",
  "/api/keywords/check",
  "/api/maps-difficulty/run",
  "/api/scans/run-for-keyword",
  "/api/audits/run",
] as const;

/** Paths that authenticate via shared secret / signature — skip browser CSRF. */
export function isCsrfExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/integrations/webhooks/incoming/") ||
    pathname === "/api/jobs/process" ||
    pathname.startsWith("/api/automations/") ||
    pathname.startsWith("/auth/") ||
    // Public free SEO tool (called from marketing site + app landing)
    pathname.startsWith("/api/public/qr") ||
    pathname.startsWith("/api/public/review-reply") ||
    pathname.startsWith("/api/public/maps-rank-check") ||
    pathname.startsWith("/api/public/local-seo-audit") ||
    // Marketing contact form (cross-origin POST from localseoexpress.com)
    pathname.startsWith("/api/public/contact")
  );
}

function buildDiagnostics(
  request: CsrfRequestLike,
  extras: {
    origin: string | null;
    refererOrigin: string | null;
    reason: string | null;
  }
): SameOriginDiagnostics {
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() ?? null;
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ?? null;
  return {
    origin: extras.origin,
    refererOrigin: extras.refererOrigin,
    canonicalOrigin: getCanonicalOrigin(),
    allowedOrigins: getAllowedOrigins(),
    requestHost: parseRequestHost(request.url),
    forwardedHost,
    forwardedProto,
    path: parsePathname(request.url),
    reason: extras.reason,
  };
}

/**
 * Evaluate same-origin for mutating requests against the configured allowlist.
 * Cookie-authenticated browser requests must send Origin or Referer.
 * Non-browser clients without cookies may omit both (Bearer / cron).
 */
export function evaluateSameOriginMutation(request: CsrfRequestLike): SameOriginDecision {
  if (!isMutatingMethod(request.method)) {
    return {
      ok: true,
      diagnostics: buildDiagnostics(request, {
        origin: null,
        refererOrigin: null,
        reason: null,
      }),
    };
  }

  const allowed = getAllowedOrigins();
  const origin = normalizeOrigin(request.headers.get("origin"));
  const refererOrigin = normalizeOrigin(request.headers.get("referer"));
  const clientOrigin = origin ?? refererOrigin;

  if (clientOrigin) {
    if (allowed.includes(clientOrigin)) {
      return {
        ok: true,
        diagnostics: buildDiagnostics(request, {
          origin,
          refererOrigin,
          reason: null,
        }),
      };
    }
    return {
      ok: false,
      diagnostics: buildDiagnostics(request, {
        origin,
        refererOrigin,
        reason: "origin_not_allowlisted",
      }),
    };
  }

  const hasCookie = Boolean(request.headers.get("cookie")?.trim());
  if (hasCookie) {
    return {
      ok: false,
      diagnostics: buildDiagnostics(request, {
        origin,
        refererOrigin,
        reason: "cookie_without_origin",
      }),
    };
  }

  // Server-to-server / cron without browser cookies
  return {
    ok: true,
    diagnostics: buildDiagnostics(request, {
      origin,
      refererOrigin,
      reason: null,
    }),
  };
}

export function isSameOriginMutation(request: CsrfRequestLike): boolean {
  return evaluateSameOriginMutation(request).ok;
}
