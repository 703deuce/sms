import { NextResponse } from "next/server";

/**
 * When TRANSOVO_DEV_API_KEY is set, mutating phone/telecom routes require the header.
 * When unset, routes are open (local dev only — not for public production).
 */
export function assertDevApiAccess(request: Request): NextResponse | null {
  const key = process.env.TRANSOVO_DEV_API_KEY?.trim();
  if (!key) return null;
  const provided = request.headers.get("x-transovo-dev-key")?.trim();
  if (provided !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
