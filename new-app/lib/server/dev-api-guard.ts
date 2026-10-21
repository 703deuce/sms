import { NextResponse } from "next/server";

function isSameSiteBrowserRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  return secFetchSite === "same-origin" || secFetchSite === "same-site";
}

/**
 * Phone UI mutations are same-origin in single-client dev — no browser-exposed API keys.
 * Full customer auth will replace this. Optional server-only key for curl/cron:
 * set TRANSOVO_DEV_API_KEY and send x-transovo-dev-key (never NEXT_PUBLIC_*).
 */
export function assertDevApiAccess(request: Request): NextResponse | null {
  return assertPhoneApiAccess(request);
}

/**
 * Guards /api/phone/* until product session auth ships.
 * - Production: block anonymous cross-site/curl (no Sec-Fetch-Site) unless dev key matches.
 * - When TRANSOVO_DEV_API_KEY is set: require key or same-site browser.
 * Telnyx ingress stays on /api/telnyx/* (separate webhook auth).
 */
export function assertPhoneApiAccess(request: Request): NextResponse | null {
  const key = process.env.TRANSOVO_DEV_API_KEY?.trim();
  const provided = request.headers.get("x-transovo-dev-key")?.trim();
  const sameSite = isSameSiteBrowserRequest(request);

  if (key) {
    if (provided === key) return null;
    if (sameSite) return null;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production" && !sameSite) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
