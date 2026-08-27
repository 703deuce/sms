import { cookies } from "next/headers";
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
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Session;
  } catch {
    return null;
  }
}

export async function getActiveWorkspaceType(): Promise<WorkspaceTypeCookie> {
  // V1 is business-only — Personal / family numbers are no longer a customer mode.
  return "BUSINESS";
}

export async function getActiveWorkspaceId() {
  const jar = await cookies();
  const fromCookie = jar.get(WORKSPACE_COOKIE)?.value;
  const session = await getSession();
  if (!session) return fromCookie || "";

  try {
    const { resolvePreferredBusinessWorkspaceId } = await import(
      "@/lib/workspace/preferred-business-workspace"
    );
    return await resolvePreferredBusinessWorkspaceId(session.userId, fromCookie);
  } catch {
    if (fromCookie) return fromCookie;
    const membership = await getPrisma().membership.findFirst({
      where: { userId: session.userId },
    });
    return membership?.workspaceId || "";
  }
}

export function encodeSession(session: Session) {
  return encodeURIComponent(JSON.stringify(session));
}
