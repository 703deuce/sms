import { NextResponse, type NextRequest } from "next/server";
import {
  parseProductAccessCookie,
  PRODUCT_ACCESS_COOKIE,
} from "@/lib/products/access-cookie";
import { productAccessDeniedRedirect } from "@/lib/products/access-guards";
import { isVoiceProductPath } from "@/lib/products/voice-routes";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";
import {
  isBusinessOnlyPath,
  isPersonalOnlyPath,
} from "@/lib/workspace/capabilities";
import {
  isNumbersPlatformOnlyLaunch,
  isPortInHiddenAtLaunch,
  isSmsMarketingHiddenAtLaunch,
} from "@/lib/workspace/platform-launch";

function isDevAuthBypassEnabled() {
  const raw = process.env.DEV_AUTH_BYPASS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function devBypassRedirect(request: NextRequest, nextPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/dev-bypass";
  url.search = "";
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

function isInternalRequestHost(request: NextRequest): boolean {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || "";
  const hostOnly = host.split(":")[0].toLowerCase();
  return !hostOnly || hostOnly === "0.0.0.0" || hostOnly === "127.0.0.1" || hostOnly === "localhost";
}

/** Same-origin redirect when possible; only rewrite origin for docker bind addresses. */
function siteRedirect(request: NextRequest, path: string) {
  if (!isInternalRequestHost(request)) {
    const url = request.nextUrl.clone();
    const target = new URL(path, "http://local");
    url.pathname = target.pathname;
    url.search = target.search;
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(publicRedirectUrl(path, request));
}

const WORKSPACE_TYPE_COOKIE = "transovo_workspace_type";

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
  "/mass-texting",
  "/sms-marketing",
  "/maintenance",
  "/app",
]);

const authPages = new Set(["/login", "/signup", "/forgot-password"]);

function isPublicPath(pathname: string) {
  if (publicExact.has(pathname)) return true;
  // Provider webhooks + cron/job drains must not require a browser session.
  if (pathname.startsWith("/api/twilio/")) return true;
  if (pathname.startsWith("/api/webhooks/twilio/")) return true;
  if (pathname.startsWith("/api/telnyx/")) return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/api/internal/voice-runtime") return true;
  // Covered by /api/telnyx/ prefix — dynamic-variables + voice tools included.
  if (pathname.startsWith("/api/jobs/")) return true;
  if (pathname.startsWith("/api/integrations/webhooks/incoming/")) return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/api/webhooks/stripe")) return true;
  if (pathname.startsWith("/api/payments/stripe/webhook")) return true;
  if (pathname.startsWith("/api/integrations/calendly/")) return true;
  if (pathname.startsWith("/api/integrations/hubspot/webhook")) return true;
  if (pathname.startsWith("/api/integrations/shopify/webhook")) return true;
  if (pathname.startsWith("/api/integrations/salesforce/webhook")) return true;
  if (pathname.startsWith("/api/integrations/google/") && pathname.includes("/callback")) return true;
  if (pathname === "/api/auth/google/callback") return true;
  // Native integrations: OAuth provider redirects + inbound webhooks (no browser session).
  if (
    pathname.startsWith("/api/integrations/native/") &&
    (pathname.includes("/callback") || pathname.includes("/webhooks/"))
  ) {
    return true;
  }
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
  if (pathname.startsWith("/embed/voice/")) return true;
  if (pathname === "/embed/form.js") return true;
  // Public Telnyx AI Assistants voice catalog downloads (NaturalHD + Ultra UUID)
  if (pathname.startsWith("/telnyx-agent-voices")) return true;
  // Prerecorded connection greeting media (public HTTPS for Telnyx playback_start)
  if (pathname.startsWith("/connection-greeting")) return true;
  // Smart Routing ElevenLabs greeting/menu audio (Telnyx gather_using_audio / playback_start)
  if (pathname.startsWith("/smart-routing-audio/")) return true;
  if (pathname.startsWith("/api/public/smart-routing-audio/")) return true;
  // Signed expiring recording streams (token-gated, no session cookie)
  if (pathname.startsWith("/api/voice/recordings/") && pathname.endsWith("/stream")) return true;
  // Calendar OAuth callbacks (provider redirects without session)
  if (pathname.startsWith("/api/voice/calendars/oauth/") && pathname.includes("/callback")) return true;
  // Local visual QA for Appointment Receptionist wizard (no product nav link)
  if (pathname === "/dev/appointment-wizard" || pathname.startsWith("/dev/appointment-wizard/")) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSmsMarketingHiddenAtLaunch() && pathname === "/sms-marketing") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (isPortInHiddenAtLaunch() && pathname === "/personal/porting") {
    const tab = request.nextUrl.searchParams.get("tab");
    if (!tab || tab === "in") {
      const url = request.nextUrl.clone();
      url.searchParams.set("tab", "out");
      return NextResponse.redirect(url);
    }
  }

  // Consolidate texting-number list under /numbers.
  if (pathname === "/my-numbers" || pathname.startsWith("/my-numbers/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/my-numbers/, "/numbers") || "/numbers";
    return NextResponse.redirect(url);
  }

  // Mass Texting product shell uses /sms/** — do not redirect to legacy flat routes.

  // Consolidate legacy outcomes dashboard under /dashboard.
  if (pathname === "/outcomes" || pathname.startsWith("/outcomes/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

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

  // Smoke / ops bootstrap header (same value as /api/auth/smoke-login).
  const smokeBootstrap =
    request.headers.get("x-smoke-bootstrap") ===
    "transovo-smoke-bootstrap-b56f-aug2026";
  const smokeOpsPath =
    pathname === "/api/numbers/telnyx-outbound-repair" ||
    pathname === "/api/numbers/telnyx-inbound-repair" ||
    pathname === "/api/voice/telnyx-official-baseline";

  if (!session && !isPublic && !(smokeBootstrap && smokeOpsPath)) {
    if (isDevAuthBypassEnabled() && pathname !== "/api/auth/dev-bypass") {
      const nextPath = `${pathname}${request.nextUrl.search || ""}`;
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized — visit /api/auth/dev-bypass first (DEV_AUTH_BYPASS=1)" },
          { status: 401 },
        );
      }
      return devBypassRedirect(request, nextPath);
    }
    // API routes without a session should 401 JSON, not HTML login redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users skip auth pages; honor `next` (unified login — no product=voice shortcut).
  if (!session && isDevAuthBypassEnabled() && authPages.has(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    return devBypassRedirect(request, next && next.startsWith("/") ? next : "/dashboard");
  }

  if (session && authPages.has(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return siteRedirect(request, next);
    }
    const product = request.nextUrl.searchParams.get("product")?.trim().toLowerCase();
    if (product === "numbers" || product === "sms" || product === "mass_texting") {
      return siteRedirect(request, `/api/products/open?product=${product}`);
    }
    if (product === "mctb") {
      return siteRedirect(request, "/onboarding/mctb");
    }
    const productKeys = parseProductAccessCookie(
      request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value,
    );
    const hasVoice = productKeys.includes("voice");
    const hasNumbers = productKeys.includes("numbers");
    const launchCount = [hasVoice, hasNumbers].filter(Boolean).length;
    if (launchCount === 1) {
      return siteRedirect(request, hasVoice ? "/dashboard" : "/personal");
    }
    return siteRedirect(request, "/app");
  }

  if (session && !isPublic) {
    const wsType = request.cookies.get(WORKSPACE_TYPE_COOKIE)?.value;
    const productKeys = parseProductAccessCookie(
      request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value,
    );
    let hasVoice = productKeys.includes("voice");
    let hasSms = productKeys.includes("sms");
    let hasNumbers = productKeys.includes("numbers");

    // Fallback for sessions before product cookie exists.
    if (!productKeys.length) {
      hasNumbers = wsType === "PERSONAL" || isNumbersPlatformOnlyLaunch();
      hasVoice = wsType === "BUSINESS" && !isNumbersPlatformOnlyLaunch();
      if (wsType === "PERSONAL") hasNumbers = true;
      if (wsType === "BUSINESS") hasVoice = true;
    } else {
      // Partial cookie (e.g. numbers-only) while business workspace cookie is active.
      if (!hasVoice && wsType === "BUSINESS") hasVoice = true;
      if (!hasNumbers && wsType === "PERSONAL") hasNumbers = true;
    }

    const denied = productAccessDeniedRedirect(
      pathname,
      {
        hasVoice,
        hasSms,
        hasNumbers,
      },
      { authenticated: true },
    );
    if (denied) {
      if (denied.startsWith("/api/products/open")) {
        const target = new URL(denied, "http://local");
        if (!target.searchParams.get("next")) {
          target.searchParams.set("next", pathname);
        }
        return siteRedirect(request, `${target.pathname}${target.search}`);
      }
      return siteRedirect(request, denied);
    }

    if (isNumbersPlatformOnlyLaunch() && isBusinessOnlyPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/personal";
      return NextResponse.redirect(url);
    }
    if (wsType === "PERSONAL" && isBusinessOnlyPath(pathname)) {
      if (isVoiceProductPath(pathname)) {
        // Voice preview while workspace cookie catches up after /api/products/open.
      } else {
        const url = request.nextUrl.clone();
        url.pathname = "/personal";
        return NextResponse.redirect(url);
      }
    }
    if (
      !isNumbersPlatformOnlyLaunch() &&
      wsType === "BUSINESS" &&
      isPersonalOnlyPath(pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
