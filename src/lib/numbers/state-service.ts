import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import {
  derivePersonalDisplayState,
  mergePersonalCallSettingsPatch,
  readPersonalCallSettings,
} from "./personal-call-settings";
import { validateForwardingDestination } from "./forwarding-validation";

export type NumberServiceAction =
  | "park"
  | "reactivate"
  | "set_forwarding"
  | "clear_forwarding"
  | "enable_voicemail"
  | "disable_voicemail"
  | "set_vault_voicemail"
  | "set_vault_message_only"
  | "set_smart_routing_owner"
  | "clear_smart_routing_owner";

function readSettings(row: { settingsJson: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
}

async function getOwned(workspaceId: string, numberId: string) {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");
  return row;
}

function withDisplayState(
  settings: Record<string, unknown>,
  row: { voiceForwardTo: string | null },
): Record<string, unknown> {
  return {
    ...settings,
    personalServiceState: derivePersonalDisplayState({
      settingsJson: settings,
      voiceForwardTo: row.voiceForwardTo,
    }),
  };
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
      const parkedSettings = withDisplayState(
        {
          ...settings,
          parked: true,
          personalParked: true,
          routingOwner: null,
          parkedSince: settings.parkedSince || now,
          forwardingEnabled: false,
        },
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            settingsJson: parkedSettings,
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "reactivate":
      const reactivatedSettings = withDisplayState(
        {
          ...settings,
          parked: false,
          personalParked: false,
          parkedSince: null,
          forwardingEnabled: Boolean(row.voiceForwardTo?.trim()),
        },
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: reactivatedSettings },
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

      const forwardSettings = withDisplayState(
        mergePersonalCallSettingsPatch(
          {
            ...settings,
            parked: false,
            personalParked: false,
            routingOwner: null,
            forwardingEnabled: true,
          },
          {},
        ),
        { voiceForwardTo: validated.e164 },
      );

      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: validated.e164,
            settingsJson: forwardSettings,
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );
    }

    case "clear_forwarding":
      const clearedSettings = withDisplayState(
        mergePersonalCallSettingsPatch(settings, { forwardingEnabled: false }),
        { voiceForwardTo: null },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: clearedSettings,
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "enable_voicemail":
      const vmSettings = withDisplayState(
        mergePersonalCallSettingsPatch(settings, { voicemailEnabled: true }),
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: vmSettings },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "disable_voicemail":
      const noVmSettings = withDisplayState(
        mergePersonalCallSettingsPatch(settings, {
          voicemailEnabled: false,
          directVoicemail: false,
        }),
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: noVmSettings },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "set_vault_voicemail":
      const vaultVmSettings = withDisplayState(
        mergePersonalCallSettingsPatch(
          {
            ...settings,
            parked: true,
            personalParked: true,
            routingOwner: null,
            parkedSince: settings.parkedSince || now,
            forwardingEnabled: false,
            vaultIncomingMode: "voicemail",
            voicemailEnabled: true,
          },
          { vaultIncomingMode: "voicemail", voicemailEnabled: true },
        ),
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: vaultVmSettings },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "set_vault_message_only":
      const vaultMsgSettings = withDisplayState(
        mergePersonalCallSettingsPatch(
          {
            ...settings,
            vaultIncomingMode: "parked_message",
          },
          { vaultIncomingMode: "parked_message" },
        ),
        { voiceForwardTo: row.voiceForwardTo },
      );
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: vaultMsgSettings },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "set_smart_routing_owner":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            voiceForwardTo: null,
            settingsJson: withDisplayState(
              {
                ...settings,
                parked: false,
                personalParked: false,
                routingOwner: "smart_routing",
                personalServiceState: "SMART_ROUTING",
              },
              { voiceForwardTo: null },
            ),
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    case "clear_smart_routing_owner":
      return mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: {
            settingsJson: withDisplayState(
              { ...settings, routingOwner: null },
              { voiceForwardTo: row.voiceForwardTo },
            ),
          },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export function applyPersonalCallSettingsToRow(
  existing: { settingsJson: unknown; voiceForwardTo: string | null; e164: string },
  patch: {
    forwardingEnabled?: boolean;
    forwardDestination?: string | null;
    forwardRingSeconds?: number;
    forwardUnansweredAction?: "voicemail" | "end";
    voicemailEnabled?: boolean;
    directVoicemail?: boolean;
    vaultIncomingMode?: "parked_message" | "voicemail";
    parkedMessageText?: string;
  },
): {
  voiceForwardTo: string | null;
  settingsJson: Record<string, unknown>;
} {
  const settings = readSettings(existing);
  const callSettings = readPersonalCallSettings(existing);
  let voiceForwardTo = existing.voiceForwardTo;

  const settingsPatch = mergePersonalCallSettingsPatch(settings, {
    forwardRingSeconds: patch.forwardRingSeconds ?? callSettings.forwardRingSeconds,
    forwardUnansweredAction:
      patch.forwardUnansweredAction ?? callSettings.forwardUnansweredAction,
    voicemailEnabled: patch.voicemailEnabled,
    directVoicemail: patch.directVoicemail,
    vaultIncomingMode: patch.vaultIncomingMode,
    parkedMessageText: patch.parkedMessageText,
    forwardingEnabled: patch.forwardingEnabled,
  });

  if (patch.forwardDestination !== undefined) {
    if (patch.forwardDestination?.trim()) {
      const validated = validateForwardingDestination({
        destination: patch.forwardDestination,
        numberE164: existing.e164,
      });
      if (!validated.ok) throw new Error(validated.error);
      voiceForwardTo = validated.e164;
    } else {
      voiceForwardTo = null;
    }
  }

  if (patch.forwardingEnabled === false) {
    voiceForwardTo = null;
    settingsPatch.forwardingEnabled = false;
  } else if (voiceForwardTo) {
    settingsPatch.forwardingEnabled = true;
  }

  return {
    voiceForwardTo,
    settingsJson: withDisplayState(settingsPatch, { voiceForwardTo }),
  };
}
