import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("transovo_session")?.value;
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // API routes authenticate themselves (session via requireSession, or Bearer/Twilio
  // signature/token for cron + webhooks). The /r/ click-tracking redirect is public.
  // Never redirect these to the login page.
  if (pathname.startsWith("/api") || pathname.startsWith("/r/")) {
    return NextResponse.next();
  }

  if (!session && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (isPublic || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
