import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_TYPE_COOKIE,
  type WorkspaceTypeCookie,
} from "@/lib/auth";

export function workspaceCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  };
}

export function applyWorkspaceCookies(
  res: { cookies: { set: (name: string, value: string, options?: Partial<ResponseCookie>) => void } },
  workspaceId: string,
  workspaceType: WorkspaceTypeCookie,
) {
  const opts = workspaceCookieOptions();
  res.cookies.set(WORKSPACE_COOKIE, workspaceId, opts);
  res.cookies.set(WORKSPACE_TYPE_COOKIE, workspaceType, opts);
}
