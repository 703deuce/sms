import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashToken } from "@/lib/appointments/service-booking/crypto";
import { CLIENT_PORTAL_COOKIE } from "./constants";

export type ClientPortalSessionContext = {
  sessionId: string;
  workspaceId: string;
  contactId: string;
  expiresAt: Date;
};

export async function resolveClientPortalSessionFromToken(
  rawToken: string | null | undefined,
): Promise<ClientPortalSessionContext | null> {
  if (!rawToken?.trim()) return null;
  const prisma = getPrisma();
  const session = await prisma.clientPortalSession.findUnique({
    where: { tokenHash: hashToken(rawToken.trim()) },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    contactId: session.contactId,
    expiresAt: session.expiresAt,
  };
}

export async function getClientPortalSessionFromCookies(): Promise<ClientPortalSessionContext | null> {
  const jar = await cookies();
  const raw = jar.get(CLIENT_PORTAL_COOKIE)?.value;
  return resolveClientPortalSessionFromToken(raw);
}

export function getClientPortalTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(CLIENT_PORTAL_COOKIE)?.value;
  if (cookie) return cookie;
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export async function requireClientPortalSession(
  request?: NextRequest,
): Promise<ClientPortalSessionContext> {
  const raw = request
    ? getClientPortalTokenFromRequest(request)
    : (await cookies()).get(CLIENT_PORTAL_COOKIE)?.value;
  const ctx = await resolveClientPortalSessionFromToken(raw);
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

export async function assertAppointmentOwnedBySession(
  ctx: ClientPortalSessionContext,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId: ctx.workspaceId, contactId: ctx.contactId },
    select: { id: true },
  });
  if (!row) throw new Error("Forbidden");
  return row;
}
