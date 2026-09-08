import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken } from "./crypto";

export async function issueClassAdmissionTicket(
  workspaceId: string,
  input: {
    enrollmentId: string;
    occurrenceId: string;
    contactId: string;
    attendeeName?: string;
  },
) {
  const prisma = getPrisma();
  const token = generateSecureToken();
  return prisma.classAdmissionTicket.create({
    data: {
      workspaceId,
      enrollmentId: input.enrollmentId,
      occurrenceId: input.occurrenceId,
      contactId: input.contactId,
      attendeeName: input.attendeeName,
      ticketCode: token.slice(0, 12).toUpperCase(),
      qrToken: token,
      status: "issued",
    },
  });
}

export async function redeemAdmissionTicket(workspaceId: string, qrToken: string) {
  const prisma = getPrisma();
  const ticket = await prisma.classAdmissionTicket.findFirst({
    where: { workspaceId, qrToken, status: { in: ["issued", "checked_in"] } },
  });
  if (!ticket) throw new Error("Invalid ticket");
  if (ticket.status === "redeemed") throw new Error("Ticket already redeemed");

  return prisma.classAdmissionTicket.update({
    where: { id: ticket.id },
    data: { status: "redeemed", redeemedAt: new Date() },
  });
}

export async function checkInAdmissionTicket(workspaceId: string, qrToken: string) {
  const prisma = getPrisma();
  const ticket = await prisma.classAdmissionTicket.findFirst({
    where: { workspaceId, qrToken, status: "issued" },
  });
  if (!ticket) throw new Error("Invalid ticket");

  return prisma.classAdmissionTicket.update({
    where: { id: ticket.id },
    data: { status: "checked_in", checkedInAt: new Date() },
  });
}
