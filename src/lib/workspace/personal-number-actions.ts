import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { transitionNumberService } from "@/lib/numbers/state-service";

async function getOwnedNumber(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  return row;
}

export async function parkPersonalNumber(workspaceId: string, numberId: string) {
  await getOwnedNumber(workspaceId, numberId);
  return transitionNumberService(workspaceId, numberId, "park");
}

export async function reactivatePersonalNumber(workspaceId: string, numberId: string) {
  await getOwnedNumber(workspaceId, numberId);
  return transitionNumberService(workspaceId, numberId, "reactivate");
}

export async function clearPortAwayWindow(workspaceId: string, numberId: string) {
  const row = await getOwnedNumber(workspaceId, numberId);
  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  const updated = await getPrisma().phoneNumber.update({
    where: { id: numberId },
    data: {
      settingsJson: {
        ...settings,
        portAwayWindowExpiresAt: null,
        personalServiceState: row.voiceForwardTo ? "FORWARDING" : "ACTIVE",
      },
    },
  });
  return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
}

export async function setPersonalVoicemailEnabled(
  workspaceId: string,
  numberId: string,
  enabled: boolean,
) {
  await getOwnedNumber(workspaceId, numberId);
  return transitionNumberService(
    workspaceId,
    numberId,
    enabled ? "enable_voicemail" : "disable_voicemail",
  );
}

export async function setVaultIncomingMode(
  workspaceId: string,
  numberId: string,
  mode: "parked_message" | "voicemail",
) {
  await getOwnedNumber(workspaceId, numberId);
  return transitionNumberService(
    workspaceId,
    numberId,
    mode === "voicemail" ? "set_vault_voicemail" : "set_vault_message_only",
  );
}

export async function loadPremiumCartCount(workspaceId: string): Promise<number> {
  const count = await getPrisma().premiumNumberReservation.count({
    where: {
      workspaceId,
      reservationStatus: { in: ["reserving", "reserved", "active"] },
      paymentStatus: { not: "paid" },
    },
  });
  return count;
}
