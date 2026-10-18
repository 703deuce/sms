import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/auth";

/** Keep users signed in across long-running flows (e.g. Visualizer KIE jobs on mobile). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function sessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

export function applySessionCookie(
  res: { cookies: { set: (name: string, value: string, options?: Partial<ResponseCookie>) => void } },
  session: Session,
) {
  res.cookies.set(SESSION_COOKIE, encodeSession(session), sessionCookieOptions());
}
