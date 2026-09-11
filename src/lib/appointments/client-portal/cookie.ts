import { CLIENT_PORTAL_COOKIE, CLIENT_PORTAL_COOKIE_MAX_AGE } from "./constants";

export function clientPortalSetCookieHeader(rawToken: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CLIENT_PORTAL_COOKIE}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CLIENT_PORTAL_COOKIE_MAX_AGE}${secure}`;
}

export function clientPortalClearCookieHeader(): string {
  return `${CLIENT_PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
