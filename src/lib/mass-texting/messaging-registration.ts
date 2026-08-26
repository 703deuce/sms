import "server-only";

import { getPrisma } from "@/lib/db";

export type MessagingProductUseCase = "MCTB_CUSTOMER_CARE" | "MASS_TEXT_MARKETING";

export async function getMessagingProductRegistration(
  workspaceId: string,
  productUseCase: MessagingProductUseCase,
) {
  const prisma = getPrisma();
  try {
    return await prisma.messagingProductRegistration.findUnique({
      where: {
        workspaceId_productUseCase: { workspaceId, productUseCase },
      },
    });
  } catch {
    return null;
  }
}

export async function ensureMessagingProductRegistration(
  workspaceId: string,
  productUseCase: MessagingProductUseCase,
) {
  const prisma = getPrisma();
  try {
    return await prisma.messagingProductRegistration.upsert({
      where: {
        workspaceId_productUseCase: { workspaceId, productUseCase },
      },
      create: {
        workspaceId,
        productUseCase,
        overallStatus: "not_started",
      },
      update: {},
    });
  } catch {
    return null;
  }
}

/** Mass Text sends must not reuse MCTB-only A2P campaign registration. */
export async function resolveMassTextSendingNumber(workspaceId: string) {
  const reg = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  if (reg?.phoneE164 && reg.messagingEnabled) {
    return {
      phoneE164: reg.phoneE164,
      phoneNumberId: reg.phoneNumberId,
      registration: reg,
    };
  }

  const prisma = getPrisma();
  const number = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      status: "Active",
    },
    orderBy: { createdAt: "asc" },
  });
  if (!number) return null;

  const settings =
    number.settingsJson && typeof number.settingsJson === "object"
      ? (number.settingsJson as Record<string, unknown>)
      : {};
  const massTextRole = String(settings.massTextRole || settings.mass_text_role || "").toLowerCase();
  if (massTextRole && massTextRole !== "none") {
    return {
      phoneE164: number.e164,
      phoneNumberId: number.id,
      registration: reg,
    };
  }

  return null;
}
