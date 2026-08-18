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

      const applied = applyPersonalCallSettingsToRow(row, {
        incomingCallHandling: "forward",
        forwardingEnabled: true,
        forwardDestination: validated.e164,
        forwardMode: "single",
        forwardRingSeconds: 25,
        forwardUnansweredAction: "voicemail",
        forwardBusyAction: "voicemail",
        forwardFailedAction: "voicemail",
        voicemailEnabled: true,
        directVoicemail: false,
      });

      const updated = await prisma.phoneNumber.update({
        where: { id: numberId },
        data: {
          voiceForwardTo: applied.voiceForwardTo,
          settingsJson: {
            ...applied.settingsJson,
            parked: false,
            personalParked: false,
            routingOwner: null,
          },
        },
      });

      const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
      await ensureNumberVoicemailBox(workspaceId, numberId);

      return mapPhoneNumber(updated as Parameters<typeof mapPhoneNumber>[0]);
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
      const vmEnabled = mapPhoneNumber(
        await prisma.phoneNumber.update({
          where: { id: numberId },
          data: { settingsJson: vmSettings },
        }) as Parameters<typeof mapPhoneNumber>[0],
      );
      const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
      await ensureNumberVoicemailBox(workspaceId, numberId);
      return vmEnabled;

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
      await prisma.phoneNumber.update({
        where: { id: numberId },
        data: { settingsJson: vaultVmSettings },
      });
      const { ensureNumberVoicemailBox: ensureVaultVmBox } = await import(
        "@/lib/phone/voicemail-service"
      );
      await ensureVaultVmBox(workspaceId, numberId);
      return mapPhoneNumber(
        await prisma.phoneNumber.findFirstOrThrow({
          where: { id: numberId, workspaceId },
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
    forwardTargets?: string[];
    forwardMode?: "single" | "sequential" | "simultaneous";
    forwardRingSeconds?: number;
    forwardUnansweredAction?: "voicemail" | "end";
    forwardBusyAction?: "voicemail" | "another_number" | "announcement" | "end";
    forwardFailedAction?: "voicemail" | "another_number" | "announcement" | "end";
    voicemailEnabled?: boolean;
    directVoicemail?: boolean;
    incomingCallHandling?: "forward" | "voicemail_only" | "announcement_only";
    vaultIncomingMode?: "silent" | "parked_message" | "voicemail";
    parkedMessageText?: string;
    announcementText?: string;
    callerIdDisplay?: "original" | "transovo_number";
    callScreeningEnabled?: boolean;
    forwardScheduleMode?: "always" | "custom";
    portOutAccountNumber?: string | null;
    portOutPin?: string | null;
    portOutLocked?: boolean;
    voicemailSecondaryEmail?: string | null;
    verificationWarningAcknowledged?: boolean;
    blockedCallerAction?: "disconnect" | "unavailable_message";
    forwardBusyNumber?: string | null;
    forwardFailedNumber?: string | null;
    forwardSchedule?: Record<string, unknown> | null;
  },
): {
  voiceForwardTo: string | null;
  settingsJson: Record<string, unknown>;
} {
  const settings = readSettings(existing);
  const callSettings = readPersonalCallSettings(existing);
  let voiceForwardTo = existing.voiceForwardTo;

  const settingsPatch = mergePersonalCallSettingsPatch(settings, {
    incomingCallHandling: patch.incomingCallHandling,
    forwardRingSeconds: patch.forwardRingSeconds ?? callSettings.forwardRingSeconds,
    forwardUnansweredAction:
      patch.forwardUnansweredAction ?? callSettings.forwardUnansweredAction,
    forwardBusyAction: patch.forwardBusyAction,
    forwardFailedAction: patch.forwardFailedAction,
    voicemailEnabled: patch.voicemailEnabled,
    directVoicemail: patch.directVoicemail,
    vaultIncomingMode: patch.vaultIncomingMode,
    parkedMessageText: patch.parkedMessageText,
    announcementText: patch.announcementText,
    forwardingEnabled: patch.forwardingEnabled,
    forwardMode: patch.forwardMode,
    callerIdDisplay: patch.callerIdDisplay,
    callScreeningEnabled: patch.callScreeningEnabled,
    forwardScheduleMode: patch.forwardScheduleMode,
    portOutAccountNumber: patch.portOutAccountNumber,
    portOutPin: patch.portOutPin,
    portOutLocked: patch.portOutLocked,
    voicemailSecondaryEmail: patch.voicemailSecondaryEmail,
    verificationWarningAcknowledged: patch.verificationWarningAcknowledged,
    blockedCallerAction: patch.blockedCallerAction,
    forwardBusyNumber: patch.forwardBusyNumber,
    forwardFailedNumber: patch.forwardFailedNumber,
    forwardSchedule: patch.forwardSchedule ?? undefined,
  });

  let validatedTargets: string[] = callSettings.forwardTargets;

  if (patch.forwardTargets !== undefined) {
    validatedTargets = [];
    for (const dest of patch.forwardTargets.slice(0, 5)) {
      const trimmed = dest?.trim();
      if (!trimmed) continue;
      const validated = validateForwardingDestination({
        destination: trimmed,
        numberE164: existing.e164,
      });
      if (!validated.ok) throw new Error(validated.error);
      validatedTargets.push(validated.e164);
    }
    settingsPatch.forwardTargets = validatedTargets;
    voiceForwardTo = validatedTargets[0] ?? null;
  }

  if (patch.forwardDestination !== undefined) {
    if (patch.forwardDestination?.trim()) {
      const validated = validateForwardingDestination({
        destination: patch.forwardDestination,
        numberE164: existing.e164,
      });
      if (!validated.ok) throw new Error(validated.error);
      voiceForwardTo = validated.e164;
      validatedTargets = [validated.e164];
      settingsPatch.forwardTargets = validatedTargets;
    } else {
      voiceForwardTo = null;
      validatedTargets = [];
      settingsPatch.forwardTargets = [];
    }
  }

  if (patch.forwardingEnabled === false) {
    voiceForwardTo = null;
    settingsPatch.forwardingEnabled = false;
    settingsPatch.forwardTargets = [];
  } else if (validatedTargets.length > 0) {
    voiceForwardTo = validatedTargets[0];
    settingsPatch.forwardingEnabled = true;
  }

  if (patch.incomingCallHandling === "voicemail_only") {
    settingsPatch.directVoicemail = true;
    settingsPatch.voicemailEnabled = true;
  }

  return {
    voiceForwardTo,
    settingsJson: withDisplayState(settingsPatch, { voiceForwardTo }),
  };
}
