import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";
import { listEligibleEntitlementsForContact } from "./entitlements";

export async function createClientPortalSession(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const rawToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3_600_000);
  const session = await prisma.clientPortalSession.create({
    data: {
      workspaceId,
      contactId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });
  return { session, rawToken, expiresAt };
}

export async function resolveClientPortalSession(token: string) {
  const prisma = getPrisma();
  const session = await prisma.clientPortalSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const [appointments, entitlements, waitlist] = await Promise.all([
    prisma.voiceAppointment.findMany({
      where: { workspaceId: session.workspaceId, contactId: session.contactId },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
    listEligibleEntitlementsForContact(session.workspaceId, session.contactId),
    prisma.appointmentWaitlistEntry.findMany({
      where: { workspaceId: session.workspaceId, contactId: session.contactId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  await prisma.clientPortalSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return { session, appointments, entitlements, waitlist };
}

export function clientPortalUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/$/, "")}/portal/${token}`;
}
