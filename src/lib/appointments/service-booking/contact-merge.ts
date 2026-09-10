import "server-only";

import { getPrisma } from "@/lib/db";

export async function previewContactMerge(
  workspaceId: string,
  sourceContactId: string,
  targetContactId: string,
) {
  const prisma = getPrisma();
  const [source, target] = await Promise.all([
    prisma.contact.findFirst({ where: { id: sourceContactId, workspaceId } }),
    prisma.contact.findFirst({ where: { id: targetContactId, workspaceId } }),
  ]);
  if (!source || !target) throw new Error("Contact not found");

  const conflicts: Record<string, { source: string | null; target: string | null }> = {};
  for (const field of ["firstName", "lastName", "email", "phone"] as const) {
    if (source[field] && target[field] && source[field] !== target[field]) {
      conflicts[field] = { source: source[field], target: target[field] };
    }
  }

  const [
    sourceAppts,
    targetAppts,
    sourcePackages,
    targetPackages,
    sourceMemberships,
    targetMemberships,
  ] = await Promise.all([
    prisma.voiceAppointment.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.voiceAppointment.count({ where: { workspaceId, contactId: targetContactId } }),
    prisma.packageBalance.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.packageBalance.count({ where: { workspaceId, contactId: targetContactId } }),
    prisma.serviceMembershipSubscription.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.serviceMembershipSubscription.count({ where: { workspaceId, contactId: targetContactId } }),
  ]);

  const sourceHousehold = await prisma.householdMember.findFirst({
    where: { contactId: sourceContactId },
    include: { household: { select: { name: true } } },
  });
  const targetHousehold = await prisma.householdMember.findFirst({
    where: { contactId: targetContactId },
    include: { household: { select: { name: true } } },
  });

  return {
    sourceContactId,
    targetContactId,
    source: {
      firstName: source.firstName,
      lastName: source.lastName,
      email: source.email,
      phone: source.phone,
    },
    target: {
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
      phone: target.phone,
    },
    conflicts,
    relatedData: {
      appointments: { source: sourceAppts, target: targetAppts },
      packages: { source: sourcePackages, target: targetPackages },
      memberships: { source: sourceMemberships, target: targetMemberships },
      notes: { source: 0, target: 0 },
      household:
        sourceHousehold?.household?.name ||
        targetHousehold?.household?.name ||
        null,
    },
    appointmentCounts: { source: sourceAppts, target: targetAppts },
  };
}

export async function mergeContacts(
  workspaceId: string,
  sourceContactId: string,
  targetContactId: string,
  chosenValues: Record<string, string>,
  performedByUserId?: string,
) {
  const prisma = getPrisma();
  const preview = await previewContactMerge(workspaceId, sourceContactId, targetContactId);

  await prisma.voiceAppointment.updateMany({
    where: { workspaceId, contactId: sourceContactId },
    data: { contactId: targetContactId },
  });
  await prisma.packageBalance.updateMany({
    where: { workspaceId, contactId: sourceContactId },
    data: { contactId: targetContactId },
  });
  await prisma.serviceMembershipSubscription.updateMany({
    where: { workspaceId, contactId: sourceContactId },
    data: { contactId: targetContactId },
  });

  await prisma.contact.update({
    where: { id: targetContactId },
    data: {
      firstName: chosenValues.firstName,
      lastName: chosenValues.lastName,
      email: chosenValues.email,
      phone: chosenValues.phone,
    },
  });

  await prisma.contact.delete({ where: { id: sourceContactId } });

  await prisma.contactMergeAudit.create({
    data: {
      workspaceId,
      sourceContactId,
      targetContactId,
      conflicts: preview.conflicts,
      chosenValues,
      performedByUserId,
    },
  });

  return { targetContactId, merged: true };
}
