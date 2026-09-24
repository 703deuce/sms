/**
 * Idempotent setup: register existing Twilio MCTB platform TFN in Transovo.
 *
 * Does NOT purchase numbers, submit TFV, or change Voice/MCTB ingress DIDs.
 *
 * Usage (staging/production — run manually after deploy review):
 *   PLATFORM_OWNER_WORKSPACE_ID=ws_... \
 *   MCTB_PLATFORM_SENDER_E164=+18885046264 \
 *   npx tsx scripts/setup-mctb-platform-sender.ts
 *
 * Optional:
 *   DRY_RUN=1 — print actions only
 *   SKIP_TWILIO_IMPORT=1 — only mark existing PhoneNumber row by E.164
 */
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  platformMctbSenderSettings,
  isPlatformMctbSenderPhoneRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import { importTwilioNumbersIntoWorkspace } from "@/lib/numbers/twilio-number-import";
import { isTfvApproved, parseMessagingComplianceFromSettings } from "@/lib/messaging/compliance/messaging-compliance";

async function main() {
  const ownerWorkspaceId = process.env.PLATFORM_OWNER_WORKSPACE_ID?.trim();
  const e164Raw = process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18885046264";
  const dryRun = process.env.DRY_RUN === "1";
  const skipImport = process.env.SKIP_TWILIO_IMPORT === "1";

  if (!ownerWorkspaceId) {
    throw new Error("PLATFORM_OWNER_WORKSPACE_ID is required");
  }

  const e164 = normalizeE164(e164Raw);
  const prisma = getPrisma();

  const roleCandidates = await prisma.phoneNumber.findMany({
    where: { e164, status: "Active" },
    select: { id: true, workspaceId: true, twilioSid: true, settingsJson: true },
  });
  const existingRole = roleCandidates.find((row) =>
    isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson }),
  );

  if (existingRole && existingRole.workspaceId === ownerWorkspaceId) {
    console.log(
      JSON.stringify({
        ok: true,
        action: "already_configured",
        phoneNumberId: existingRole.id,
        e164,
        workspaceId: ownerWorkspaceId,
        env: `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=${existingRole.id}`,
      }),
    );
    return;
  }

  if (!skipImport && !dryRun) {
    await importTwilioNumbersIntoWorkspace({
      workspaceId: ownerWorkspaceId,
      e164s: [e164],
      transferFromParent: false,
    });
  }

  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId: ownerWorkspaceId, e164 },
    select: { id: true, settingsJson: true, twilioSid: true, providerNumberId: true },
  });

  if (!row) {
    throw new Error(
      `PhoneNumber row not found for ${e164} in workspace ${ownerWorkspaceId}. Run Twilio import or set SKIP_TWILIO_IMPORT=0.`,
    );
  }

  const settings = platformMctbSenderSettings({ provider: "twilio", tfvApproved: true });
  const compliance = parseMessagingComplianceFromSettings(settings);
  if (!compliance || !isTfvApproved(compliance.status as string)) {
    throw new Error("Platform sender settings must include approved TFV state");
  }

  if (!dryRun) {
    await prisma.phoneNumber.update({
      where: { id: row.id },
      data: {
        provider: "twilio",
        status: "Active",
        settingsJson: {
          ...(typeof row.settingsJson === "object" && row.settingsJson ? row.settingsJson : {}),
          ...settings,
        },
      },
    });
  }

  const verified = await prisma.phoneNumber.findUnique({
    where: { id: row.id },
    select: { id: true, e164: true, workspaceId: true, settingsJson: true },
  });

  if (!verified || !isPlatformMctbSenderPhoneRecord({ settingsJson: verified.settingsJson })) {
    throw new Error("Failed to persist platform_mctb_sender role");
  }

  console.log(
    JSON.stringify({
      ok: true,
      action: dryRun ? "dry_run_would_configure" : "configured",
      phoneNumberId: verified.id,
      e164: verified.e164,
      workspaceId: verified.workspaceId,
      twilioSid: row.twilioSid || row.providerNumberId,
      env: `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=${verified.id}`,
      notes: [
        "Ensure platform-owner MessagingRegistration subaccount can send from this TFN (From E.164 or Messaging Service).",
        "Configure Twilio inbound webhook to /api/twilio/inbound after deploy.",
      ],
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
