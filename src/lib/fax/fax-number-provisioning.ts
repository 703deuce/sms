import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { telnyxNumberProvider } from "@/lib/numbers/providers/telnyx-number-provider";
import { getTelnyxFaxApplicationId } from "./telnyx-fax-client";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

export async function searchFaxNumbers(areaCode: string) {
  const result = await telnyxNumberProvider.searchInventory({
    areaCode,
    keywordDigitStrings: [],
    memorablePatterns: [],
    baseLimit: 25,
  });
  return result.candidates.map((c) => ({
    e164: c.e164,
    nationalNumber: c.nationalNumber,
    monthlyCost: c.monthlyCost,
    providerReference: c.providerReference,
  }));
}

export async function provisionFaxNumber(input: {
  workspaceId: string;
  e164: string;
  label?: string;
}) {
  const prisma = getPrisma();
  const account = await prisma.faxAccount.findUnique({ where: { workspaceId: input.workspaceId } });
  if (!account) throw new Error("FAX_ACCOUNT_NOT_FOUND");

  const existing = await prisma.faxNumber.findFirst({
    where: { workspaceId: input.workspaceId, status: "active" },
  });
  if (existing) throw new Error("FAX_NUMBER_ALREADY_ACTIVE");

  const purchased = await telnyxNumberProvider.purchaseNumber({
    workspaceId: input.workspaceId,
    e164: input.e164,
  });

  const faxAppId = getTelnyxFaxApplicationId();

  try {
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(purchased.providerNumberId)}`, {
      method: "PATCH",
      body: {
        connection_id: faxAppId,
      },
    });
  } catch {
    // number may already be on a connection — continue
  }

  const faxNumber = await prisma.faxNumber.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      faxAccountId: account.id,
      e164: input.e164,
      label: input.label || "Main Fax",
      telnyxNumberId: purchased.providerNumberId,
      telnyxConnectionId: faxAppId,
      status: purchased.pending ? "pending" : "active",
      provisionedAt: purchased.pending ? null : new Date(),
    },
  });

  await prisma.faxAccount.update({
    where: { id: account.id },
    data: { numberStatus: purchased.pending ? "pending" : "active" },
  });

  return faxNumber;
}

export async function listFaxNumbers(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.faxNumber.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPrimaryFaxNumber(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.faxNumber.findFirst({
    where: { workspaceId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
}
