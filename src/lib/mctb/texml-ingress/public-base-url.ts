import "server-only";

import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

/** Public HTTPS origin for TeXML Gather/Play/Record callback URLs. */
export function resolveMctbPublicBaseUrl(request?: Request): string {
  const fromEnv =
    process.env.APP_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "";
  if (fromEnv) return fromEnv;

  if (request) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    if (host) {
      const proto =
        forwardedProto ||
        (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
    try {
      return new URL(request.url).origin;
    } catch {
      // fall through
    }
  }

  return getAppBaseUrl();
}

export function mctbPublicBaseUrlDiagnostics(request?: Request): {
  resolved: string;
  appUrl: string | null;
  nextPublicAppUrl: string | null;
  requestHost: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
} {
  return {
    resolved: resolveMctbPublicBaseUrl(request),
    appUrl: process.env.APP_URL?.trim() || null,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    requestHost: request?.headers.get("host") || null,
    forwardedHost: request?.headers.get("x-forwarded-host") || null,
    forwardedProto: request?.headers.get("x-forwarded-proto") || null,
  };
}
