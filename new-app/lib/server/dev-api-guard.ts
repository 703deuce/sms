import { NextResponse } from "next/server";

/**
 * Phone UI mutations are same-origin in single-client dev — no browser-exposed API keys.
 * Full customer auth will replace this. Optional server-only key for curl/cron:
 * set TRANSOVO_DEV_API_KEY and send x-transovo-dev-key (never NEXT_PUBLIC_*).
 */
export function assertDevApiAccess(request: Request): NextResponse | null {
  const key = process.env.TRANSOVO_DEV_API_KEY?.trim();
  if (!key) return null;
  const provided = request.headers.get("x-transovo-dev-key")?.trim();
  if (provided === key) return null;
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
