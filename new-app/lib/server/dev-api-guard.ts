import { NextResponse } from "next/server";
import { assertClipsRouteAccess } from "@/lib/server/clips-route-access";

/**
 * Clips mutations: clips cookie gate + optional TRANSOVO_DEV_API_KEY for automation.
 */
export function assertDevApiAccess(request: Request): NextResponse | null {
  return assertClipsRouteAccess(request);
}
