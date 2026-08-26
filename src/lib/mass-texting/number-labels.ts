import type { PhoneNumber } from "@/lib/types";
import { readPhoneProductRoles } from "@/lib/mass-texting/product-source";

export type NumberProductLabel = {
  primary: "mctb" | "mass_text" | "shared" | "unassigned";
  label: string;
  shortLabel: string;
};

export function labelPhoneNumberForProducts(phone: PhoneNumber): NumberProductLabel {
  const roles = readPhoneProductRoles(phone.settingsJson);
  if (roles.mctb && roles.massText) {
    return {
      primary: "shared",
      label: "Missed Call Text Back + Mass Texting",
      shortLabel: "MCTB + Mass Text",
    };
  }
  if (roles.mctb) {
    return {
      primary: "mctb",
      label: "Missed Call Text Back",
      shortLabel: "MCTB",
    };
  }
  if (roles.massText) {
    return {
      primary: "mass_text",
      label: "Mass Texting",
      shortLabel: "Mass Text",
    };
  }
  return {
    primary: "unassigned",
    label: "Unassigned",
    shortLabel: "—",
  };
}

export async function assignMassTextingNumberRole(
  workspaceId: string,
  phoneNumberId: string,
): Promise<void> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!phone) return;
  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object"
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};
  settings.massTextRole = "primary";
  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { settingsJson: settings },
  });
  const { reconcileMassTextMessagingRegistration } = await import(
    "@/lib/mass-texting/messaging-registration"
  );
  const existing = await prisma.messagingProductRegistration.findUnique({
    where: {
      workspaceId_productUseCase: {
        workspaceId,
        productUseCase: "MASS_TEXT_MARKETING",
      },
    },
  });
  await reconcileMassTextMessagingRegistration({
    workspaceId,
    overallStatus: existing?.overallStatus || "not_started",
    messagingEnabled: existing?.messagingEnabled || false,
    phoneAttached: true,
    phoneE164: phone.e164,
    phoneNumberId: phone.id,
  });
}

export async function assignMctbNumberRole(
  workspaceId: string,
  phoneNumberId: string,
  role: string = "customer_mctb",
): Promise<void> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!phone) return;
  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object"
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};
  settings.mctbRole = role;
  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { settingsJson: settings },
  });
}
