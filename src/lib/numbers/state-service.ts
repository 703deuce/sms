import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { validateForwardingDestination } from "./forwarding-validation";

export type NumberServiceAction =
  | "park"
  | "reactivate"
  | "set_forwarding"
  | "clear_forwarding"
  | "enable_voicemail"
  | "disable_voicemail"
  | "set_smart_routing_owner"
  | "clear_smart_routing_owner";

function readSettings(row: { settingsJson: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
}

function deriveServiceState(settings: Record<string, unknown>, voiceForwardTo: string | null) {
  if (settings.parked === true || settings.personalParked === true) return "PARKED";
  if (settings.routingOwner === "smart_routing") return "SMART_ROUTING";
  if (voiceForwardTo) return "FORWARDING";
  if (settings.voicemailEnabled === true) return "VOICEMAIL";
  return "ACTIVE";
}

async function getOwned(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  return row;
}

export async function transitionNumberService(
  workspaceId: string,
  numberId: string,
  action: NumberServiceAction,
  payload?: { destination?: string },
) {
  const prisma = getPrisma();
  const row = await getOwned(workspaceId, numberId);
  const settings = readSettings(row);
  const now = new Date().toISOString();

  switch (action) {
    case "park":
      await prisma.callForwardingRule.updateMany({
        where: { workspaceId, phoneNumberId: numberId, active: true },
        data: { active: false },
      });
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: {
              ...settings,
              parked: true,
              personalParked: true,
              personalServiceState: "PARKED",
              routingOwner: null,
              parkedSince: settings.parkedSince || now,
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "reactivate":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            settingsJson: {
              ...settings,
              parked: false,
              personalParked: false,
              personalServiceState: deriveServiceState(settings, row.voiceForwardTo),
              parkedSince: null,
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "set_forwarding": {
      const dest = payload?.destination?.trim();
      if (!dest) throw new Error("Forwarding destination required");
      const validated = validateForwardingDestination({
        destination: dest,
        numberE164: row.e164,
      });
      if (!validated.ok) throw new Error(validated.error);

      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: validated.e164,
            settingsJson: {
              ...settings,
              parked: false,
              personalParked: false,
              routingOwner: null,
              voicemailEnabled: false,
              personalServiceState: "FORWARDING",
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );
    }

    case "clear_forwarding":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: {
              ...settings,
              personalServiceState: deriveServiceState(
                { ...settings, voicemailEnabled: settings.voicemailEnabled },
                null,
              ),
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "enable_voicemail":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: {
              ...settings,
              parked: false,
              personalParked: false,
              routingOwner: null,
              voicemailEnabled: true,
              personalServiceState: "VOICEMAIL",
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "disable_voicemail":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            settingsJson: {
              ...settings,
              voicemailEnabled: false,
              personalServiceState: deriveServiceState(
                { ...settings, voicemailEnabled: false },
                row.voiceForwardTo,
              ),
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "set_smart_routing_owner":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: {
              ...settings,
              parked: false,
              personalParked: false,
              routingOwner: "smart_routing",
              personalServiceState: "SMART_ROUTING",
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "clear_smart_routing_owner":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            settingsJson: {
              ...settings,
              routingOwner: null,
              personalServiceState: deriveServiceState(settings, row.voiceForwardTo),
            },
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
