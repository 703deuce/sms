import { cookies } from "next/headers";
import { demoUser, workspaces } from "@/lib/mock/data";

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
  return jar.get(WORKSPACE_COOKIE)?.value ?? workspaces[0].id;
}

export function createDemoSession(email: string, name?: string): Session {
  return {
    userId: demoUser.id,
    email: email || demoUser.email,
    name: name || demoUser.name,
    isAdmin: true,
  };
}
