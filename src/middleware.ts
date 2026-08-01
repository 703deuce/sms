import { NextResponse, type NextRequest } from "next/server";

const publicExact = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/sms-opt-in",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
  "/maintenance",
]);

const authPages = new Set(["/login", "/signup", "/forgot-password"]);

function isPublicPath(pathname: string) {
  if (publicExact.has(pathname)) return true;
  // Provider webhooks + cron/job drains must not require a browser session.
  if (pathname.startsWith("/api/twilio/")) return true;
  if (pathname.startsWith("/api/telnyx/")) return true;
  if (pathname.startsWith("/api/jobs/")) return true;
  if (pathname.startsWith("/api/integrations/webhooks/incoming/")) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/api/payments/stripe/webhook")) return true;
  if (pathname.startsWith("/api/integrations/calendly/")) return true;
  if (pathname.startsWith("/api/integrations/hubspot/webhook")) return true;
  if (pathname.startsWith("/api/integrations/shopify/webhook")) return true;
  if (pathname.startsWith("/api/integrations/salesforce/webhook")) return true;
  if (pathname.startsWith("/api/integrations/google/") && pathname.includes("/callback")) return true;
  // CRM OAuth callbacks — provider-specific + legacy shared
  if (pathname.startsWith("/api/crm/oauth/callback")) return true;
  if (/^\/api\/crm\/(zoho|pipedrive|salesforce)\/callback\/?$/.test(pathname)) return true;
  if (pathname.startsWith("/api/crm/webhooks/")) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/api/invite/")) return true;
  if (pathname.startsWith("/messaging/payments/mock/")) return true;
  if (pathname.startsWith("/r/")) return true;
  // Hosted + embeddable opt-in forms (consent capture)
  if (pathname.startsWith("/f/")) return true;
  if (pathname.startsWith("/s/")) return true;
  if (pathname.startsWith("/embed/f/")) return true;
  if (pathname.startsWith("/embed/w/")) return true;
  if (pathname === "/embed/form.js") return true;
  // Signed expiring recording streams (token-gated, no session cookie)
  if (pathname.startsWith("/api/voice/recordings/") && pathname.endsWith("/stream")) return true;
  // Calendar OAuth callbacks (provider redirects without session)
  if (pathname.startsWith("/api/voice/calendars/oauth/") && pathname.includes("/callback")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("transovo_session")?.value;
  const isPublic = isPublicPath(pathname);
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  // Maintenance mode (edge-safe via env override; DB flag enforced in layout/API).
  const maintenanceEnv = process.env.MAINTENANCE_MODE === "1" || process.env.MAINTENANCE_MODE === "true";
  if (maintenanceEnv && !pathname.startsWith("/admin") && !pathname.startsWith("/api/admin") && !isPublicPath(pathname) && pathname !== "/maintenance") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Platform maintenance in progress" }, { status: 503 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.redirect(url);
  }

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
