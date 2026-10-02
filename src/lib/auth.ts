import { cookies } from "next/headers";
import { resolveDevAutoSession } from "@/lib/auth/dev-auto-session";
import { getPrisma } from "@/lib/db";

export const SESSION_COOKIE = "transovo_session";
export const WORKSPACE_COOKIE = "transovo_workspace";
export const WORKSPACE_TYPE_COOKIE = "transovo_workspace_type";

export type WorkspaceTypeCookie = "PERSONAL" | "BUSINESS";

export type Session = {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    try {
      return JSON.parse(decodeURIComponent(raw)) as Session;
    } catch {
      return null;
    }
  }
  const dev = await resolveDevAutoSession();
  return dev?.session ?? null;
}

export async function getActiveWorkspaceType(): Promise<WorkspaceTypeCookie> {
  // V1 is business-only — Personal / family numbers are no longer a customer mode.
  return "BUSINESS";
}

function parseSessionCookie(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Session;
  } catch {
    return null;
  }
}

export async function getActiveWorkspaceId() {
  const jar = await cookies();
  const fromCookie = jar.get(WORKSPACE_COOKIE)?.value;
  const sessionFromCookie = parseSessionCookie(jar.get(SESSION_COOKIE)?.value);

  // Real session cookie wins over DEV_AUTH_BYPASS auto-session (fresh-cert lane / bypass 2).
  if (sessionFromCookie) {
    try {
      const { resolvePreferredBusinessWorkspaceId } = await import(
        "@/lib/workspace/preferred-business-workspace"
      );
      const resolved = await resolvePreferredBusinessWorkspaceId(
        sessionFromCookie.userId,
        fromCookie,
      );
      if (resolved) return resolved;
    } catch {
      /* fall through */
    }
    if (fromCookie) return fromCookie;
    const membership = await getPrisma().membership.findFirst({
      where: { userId: sessionFromCookie.userId },
    });
    return membership?.workspaceId || "";
  }

  const dev = await resolveDevAutoSession();
  if (dev) return fromCookie || dev.workspaceId;

  return fromCookie || "";
}

export function encodeSession(session: Session) {
  return encodeURIComponent(JSON.stringify(session));
}
