/**
 * Configure per-number call forwarding + voicemail overflow for Personal numbers.
 *
 * Usage:
 *   FORWARD_TO=+17038166017 npx tsx scripts/configure-personal-forwarding.ts
 *   FORWARD_TO=+17038166017 TWILIO_E164=+18665779653 TELNYX_E164=+18663464256 npx tsx ...
 */
import { getPrisma } from "../src/lib/db";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { applyPersonalCallSettingsToRow } from "../src/lib/numbers/state-service";
import { ensureNumberVoicemailBox } from "../src/lib/phone/voicemail-service";
import { twilioNumberProvider } from "../src/lib/numbers/providers/twilio-number-provider";

const FORWARD_TO = normalizeE164(
  process.env.FORWARD_TO || process.env.PERSONAL_FORWARD_TO || "+17038166017",
);
const TWILIO_E164 = process.env.TWILIO_E164?.trim() || "+18665779653";
const TELNYX_E164 = process.env.TELNYX_E164?.trim() || "+18663464256";
const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim();

async function configureNumber(
  workspaceId: string,
  e164: string,
  label: string,
) {
  const prisma = getPrisma();
  const normalized = normalizeE164(e164);
  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: normalized, releasedAt: null },
  });
  if (!row) {
    console.error(`SKIP ${label}: number ${normalized} not found in workspace`);
    return false;
  }

  const applied = applyPersonalCallSettingsToRow(row, {
    incomingCallHandling: "forward",
    forwardingEnabled: true,
    forwardDestination: FORWARD_TO,
    forwardMode: "single",
    forwardRingSeconds: 25,
    forwardUnansweredAction: "transovo_voicemail",
    forwardBusyAction: "voicemail",
    forwardFailedAction: "voicemail",
    voicemailEnabled: true,
    directVoicemail: false,
    callScreeningEnabled: true,
    forwardScreeningSeconds: 8,
  });

  await prisma.phoneNumber.update({
    where: { id: row.id },
    data: {
      voiceForwardTo: applied.voiceForwardTo,
      settingsJson: applied.settingsJson,
    },
  });

  await ensureNumberVoicemailBox(workspaceId, row.id);

  if (row.provider === "twilio" && row.providerNumberId) {
    try {
      await twilioNumberProvider.configureVoiceWebhook(row.providerNumberId, workspaceId);
      console.log(`  Twilio voice webhook configured for ${normalized}`);
    } catch (err) {
      console.warn(`  Twilio voice webhook configure failed:`, err);
    }
  }

  console.log(`OK ${label} ${normalized} → ${FORWARD_TO} (voicemail on no answer)`);
  return true;
}

async function main() {
  const prisma = getPrisma();
  let workspaceId = WORKSPACE_ID;

  const twilioNormalized = normalizeE164(TWILIO_E164);
  const telnyxNormalized = normalizeE164(TELNYX_E164);

  if (!workspaceId) {
    const anchor = await prisma.phoneNumber.findFirst({
      where: {
        e164: { in: [twilioNormalized, telnyxNormalized] },
        releasedAt: null,
      },
      select: { workspaceId: true },
    });
    workspaceId = anchor?.workspaceId;
  }

  if (!workspaceId) {
    const ws = await prisma.workspace.findFirst({
      where: { type: "PERSONAL" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
    if (!ws) throw new Error("No PERSONAL workspace found");
    workspaceId = ws.id;
    console.log(`Workspace (fallback): ${ws.name} (${workspaceId})`);
  } else {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    console.log(`Workspace: ${ws?.name || workspaceId} (${workspaceId})`);
  }

  console.log(`Forward destination: ${FORWARD_TO}`);

  const twilioOk = await configureNumber(workspaceId, TWILIO_E164, "twilio");
  const telnyxOk = await configureNumber(workspaceId, TELNYX_E164, "telnyx");

  if (!twilioOk && !telnyxOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
