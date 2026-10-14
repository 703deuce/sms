import { getSession } from "@/lib/auth";

export async function requireRecentAuth(): Promise<{
  userId: string;
  email: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("Authentication required");
  return { userId: session.userId, email: session.email };
}
