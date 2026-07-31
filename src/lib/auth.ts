import { cookies } from "next/headers";
import { getPrisma } from "@/lib/db";

export const SESSION_COOKIE = "transovo_session";
export const WORKSPACE_COOKIE = "transovo_workspace";

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

export async function getActiveWorkspaceId() {
  const jar = await cookies();
  const fromCookie = jar.get(WORKSPACE_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const session = await getSession();
  if (!session) return "";

  try {
    const membership = await getPrisma().membership.findFirst({
      where: { userId: session.userId },
    });
    return membership?.workspaceId || "";
  } catch {
    return "";
  }
}

export function encodeSession(session: Session) {
  return encodeURIComponent(JSON.stringify(session));
}
