import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";

function readSettings(row: { settingsJson: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? { ...(row.settingsJson as Record<string, unknown>) }
    : {};
}

async function getOwnedNumber(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  return row;
}

export async function parkPersonalNumber(workspaceId: string, numberId: string) {
  const row = await getOwnedNumber(workspaceId, numberId);
  const settings = readSettings(row);
  const now = new Date().toISOString();

  const updated = await getPrisma().phoneNumber.update({
    where: { id: numberId },
    data: {
      voiceForwardTo: null,
      settingsJson: {
        ...settings,
        parked: true,
        personalParked: true,
        personalServiceState: "PARKED",
        parkedSince: settings.parkedSince || now,
      },
    },
  });
  return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
}

export async function reactivatePersonalNumber(workspaceId: string, numberId: string) {
  const row = await getOwnedNumber(workspaceId, numberId);
  const settings = readSettings(row);

  const updated = await getPrisma().phoneNumber.update({
    where: { id: numberId },
    data: {
      settingsJson: {
        ...settings,
        parked: false,
        personalParked: false,
        personalServiceState: row.voiceForwardTo ? "FORWARDING" : "ACTIVE",
        parkedSince: null,
      },
    },
  });
  return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
}

export async function clearPortAwayWindow(workspaceId: string, numberId: string) {
  const row = await getOwnedNumber(workspaceId, numberId);
  const settings = readSettings(row);

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
  const row = await getOwnedNumber(workspaceId, numberId);
  const settings = readSettings(row);
  const parked = settings.parked === true || settings.personalParked === true;

  let personalServiceState = settings.personalServiceState as string | undefined;
  if (parked) {
    personalServiceState = "PARKED";
  } else if (row.voiceForwardTo) {
    personalServiceState = "FORWARDING";
  } else if (enabled) {
    personalServiceState = "VOICEMAIL";
  } else {
    personalServiceState = "ACTIVE";
  }

  const updated = await getPrisma().phoneNumber.update({
    where: { id: numberId },
    data: {
      settingsJson: {
        ...settings,
        voicemailEnabled: enabled,
        personalServiceState,
      },
    },
  });
  return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
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
