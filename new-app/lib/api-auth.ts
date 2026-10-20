import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function requireSession() {
  const workspaceId = await resolveWorkspaceId();
  return {
    session: {
      userId: process.env.DEV_AUTH_USER_ID?.trim() || "new-app-dev",
      email: process.env.DEV_AUTH_EMAIL?.trim() || "dev@transovo.local",
      isAdmin: false,
    },
    workspaceId,
  };
}

export function jsonError(err: unknown, status = 400) {
  const message =
    err instanceof Error
      ? err.message && err.message !== "[object Object]"
        ? err.message
        : "Request failed"
      : typeof err === "string"
        ? err
        : "Request failed";
  const httpStatus = /forbidden|unauthorized/i.test(message) ? 403 : status;
  return NextResponse.json({ error: message }, { status: httpStatus });
}
