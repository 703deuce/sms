import { getSession, getActiveWorkspaceId } from "@/lib/auth";

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string | null;
  isAuthenticated: boolean;
}

export async function getAuthContext(): Promise<AuthContext> {
  const session = await getSession();
  if (!session) {
    return {
      userId: "",
      organizationId: "",
      email: null,
      isAuthenticated: false,
    };
  }

  const workspaceId = await getActiveWorkspaceId();

  return {
    userId: session.userId,
    organizationId: workspaceId || "",
    email: session.email,
    isAuthenticated: true,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth.isAuthenticated) throw new Error("Authentication required");
  return auth;
}
