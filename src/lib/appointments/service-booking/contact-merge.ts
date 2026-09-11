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

  const [sourceAppts, targetAppts, sourcePkgs, targetPkgs, sourceMems, targetMems] = await Promise.all([
    prisma.voiceAppointment.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.voiceAppointment.count({ where: { workspaceId, contactId: targetContactId } }),
    prisma.packageBalance.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.packageBalance.count({ where: { workspaceId, contactId: targetContactId } }),
    prisma.serviceMembershipSubscription.count({ where: { workspaceId, contactId: sourceContactId } }),
    prisma.serviceMembershipSubscription.count({ where: { workspaceId, contactId: targetContactId } }),
  ]);

  return {
    sourceContactId,
    targetContactId,
    conflicts,
    appointmentCounts: { source: sourceAppts, target: targetAppts },
    packageCounts: { source: sourcePkgs, target: targetPkgs },
    membershipCounts: { source: sourceMems, target: targetMems },
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
  await prisma.intakeFormResponse.updateMany({
    where: { workspaceId, contactId: sourceContactId },
    data: { contactId: targetContactId },
  });
  await prisma.posSession.updateMany({
    where: { workspaceId, contactId: sourceContactId },
    data: { contactId: targetContactId },
  });

  const target = await prisma.contact.findFirst({ where: { id: targetContactId, workspaceId } });
  if (!target) throw new Error("Contact not found");

  await prisma.contact.update({
    where: { id: targetContactId },
    data: {
      firstName: chosenValues.firstName ?? target.firstName,
      lastName: chosenValues.lastName ?? target.lastName,
      email: chosenValues.email ?? target.email,
      phone: chosenValues.phone ?? target.phone,
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
