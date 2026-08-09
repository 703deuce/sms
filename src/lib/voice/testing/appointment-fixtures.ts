import { getPrisma } from "@/lib/db";

export async function seedConfirmedAppointment(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  callerPhone: string;
  contactName?: string;
  serviceName?: string;
  startsAt?: Date;
}): Promise<{ appointmentId: string; contactId: string; startsAt: Date }> {
  const prisma = getPrisma();
  const startsAt =
    input.startsAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const existingContact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: input.callerPhone },
  });
  const contact =
    existingContact ||
    (await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone: input.callerPhone,
        firstName: input.contactName?.split(" ")[0] || "John",
        lastName: input.contactName?.split(" ").slice(1).join(" ") || "Smith",
        email: "john.smith.test@example.com",
      },
    }));

  const appointment = await prisma.voiceAppointment.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      contactId: contact.id,
      serviceName: input.serviceName || "Plumbing Repair",
      status: "confirmed",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      metadata: {
        phone: input.callerPhone,
        customerPhone: input.callerPhone,
        customer_name: input.contactName || "John Smith",
      } as object,
    },
  });

  return {
    appointmentId: appointment.id,
    contactId: contact.id,
    startsAt,
  };
}

export async function loadAppointmentStatus(appointmentId: string): Promise<{
  status: string;
  startsAt: Date;
} | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findUnique({
    where: { id: appointmentId },
    select: { status: true, startsAt: true },
  });
  return row;
}
