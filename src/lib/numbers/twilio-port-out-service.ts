/**
 * Twilio port-out credentials for Personal numbers (provider=twilio).
 * Account number is the workspace subaccount SID; PIN is stored locally (Twilio issues on request for US local).
 */

import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { readPersonalCallSettings } from "./personal-call-settings";

export async function syncPersonalPortOutFromTwilio(
  workspaceId: string,
  numberId: string,
): Promise<{
  accountNumber: string | null;
  pin: string | null;
  twilioSynced: boolean;
  provider: "twilio";
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) {
    return { accountNumber: null, pin: null, twilioSynced: false, provider: "twilio" };
  }

  const reg = await getRegistrationByWorkspace(workspaceId);
  const accountNumber =
    reg?.subaccountSid?.trim() ||
    row.twilioSid?.trim() ||
    row.providerNumberId?.trim() ||
    null;

  const callSettings = readPersonalCallSettings({
    settingsJson: row.settingsJson,
    voiceForwardTo: row.voiceForwardTo,
  });

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  if (accountNumber) settings.portOutAccountNumber = accountNumber;
  if (callSettings.portOutPin) settings.portOutPin = callSettings.portOutPin;

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { settingsJson: settings },
  });

  return {
    accountNumber,
    pin: callSettings.portOutPin,
    twilioSynced: Boolean(accountNumber),
    provider: "twilio",
  };
}
