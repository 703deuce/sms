import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { assertPhoneApiAccess } from "@/lib/server/dev-api-guard";

export function middleware(request: NextRequest) {
  const denied = assertPhoneApiAccess(request);
  if (denied) return denied;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/phone/:path*",
};
