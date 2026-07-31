import { NextResponse, type NextRequest } from "next/server";

const publicExact = new Set([
  "/",
  "/login",
  "/signup",
  "/sms-opt-in",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
]);

const authPages = new Set(["/login", "/signup"]);

function isPublicPath(pathname: string) {
  if (publicExact.has(pathname)) return true;
  // Provider webhooks + cron/job drains must not require a browser session.
  if (pathname.startsWith("/api/twilio/")) return true;
  if (pathname.startsWith("/api/telnyx/")) return true;
  if (pathname.startsWith("/api/jobs/")) return true;
  if (pathname.startsWith("/api/integrations/webhooks/incoming/")) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/r/")) return true;
  // Hosted + embeddable opt-in forms (consent capture)
  if (pathname.startsWith("/f/")) return true;
  if (pathname.startsWith("/embed/f/")) return true;
  if (pathname === "/embed/form.js") return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("transovo_session")?.value;
  const isPublic = isPublicPath(pathname);
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  if (!session && !isPublic) {
    // API routes without a session should 401 JSON, not HTML login redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users skip auth pages; landing (/) stays available for marketing/Telnyx review.
  if (session && authPages.has(pathname)) {
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
