import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";

export async function listContractTemplates(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.bookingContractTemplate.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertContractTemplate(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    bodyHtml: string;
    version: string;
    requireBeforePayment?: boolean;
    eligibleTypeIds?: string[];
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    bodyHtml: input.bodyHtml,
    version: input.version,
    requireBeforePayment: input.requireBeforePayment ?? false,
    eligibleTypeIds: input.eligibleTypeIds || [],
    active: input.active ?? true,
  };
  if (input.id) {
    return prisma.bookingContractTemplate.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.bookingContractTemplate.create({ data: { workspaceId, ...data } });
}

export async function issueContractForAppointment(
  workspaceId: string,
  input: {
    templateId: string;
    appointmentId: string;
    contactId?: string;
  },
) {
  const prisma = getPrisma();
  const template = await prisma.bookingContractTemplate.findFirst({
    where: { id: input.templateId, workspaceId, active: true },
  });
  if (!template) throw new Error("Contract template not found");

  const rawToken = generateSecureToken();
  return prisma.signedBookingContract.create({
    data: {
      workspaceId,
      templateId: template.id,
      appointmentId: input.appointmentId,
      contactId: input.contactId,
      templateVersion: template.version,
      bodySnapshot: template.bodyHtml,
      status: "unsigned",
      signTokenHash: hashToken(rawToken),
    },
  });
}

export async function signContract(
  signToken: string,
  input: { signerName: string; signatureDataUrl?: string },
) {
  const prisma = getPrisma();
  const contract = await prisma.signedBookingContract.findFirst({
    where: { signTokenHash: hashToken(signToken), status: "unsigned" },
  });
  if (!contract) throw new Error("Contract not found or already signed");

  return prisma.signedBookingContract.update({
    where: { id: contract.id },
    data: {
      status: "signed",
      signedAt: new Date(),
      signerName: input.signerName,
      signatureDataUrl: input.signatureDataUrl,
    },
  });
}
