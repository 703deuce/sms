/**
 * Idempotent setup: register existing Twilio MCTB platform TFN in Transovo (Model B).
 *
 * Does NOT require MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID (that env is set after adoption).
 * Does NOT purchase numbers, submit TFV, move to subaccount, or change Voice/MCTB ingress DIDs.
 *
 * Usage:
 *   MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_... \
 *   MCTB_PLATFORM_SENDER_E164=+18885046264 \
 *   npx tsx scripts/setup-mctb-platform-sender.ts
 *
 * Optional: DRY_RUN=1 — print planned adoption only (no DB write)
 */
import {
  adoptMctbPlatformSenderFromParentAccount,
  adoptMctbPlatformSenderFromTelnyxAccount,
} from "@/lib/mctb/messaging/platform-sender-adopt";
import { requireMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function main() {
  const ownerWorkspaceId = requireMctbPlatformOwnerWorkspaceId();
  const provider = (process.env.MCTB_PLATFORM_SENDER_PROVIDER?.trim() || "twilio").toLowerCase();
  const e164Default = provider === "telnyx" ? "+18666020680" : "+18885046264";
  const e164Raw = process.env.MCTB_PLATFORM_SENDER_E164?.trim() || e164Default;
  const dryRun = process.env.DRY_RUN === "1";
  const e164 = normalizeE164(e164Raw);

  if (dryRun) {
    console.log(
      JSON.stringify({
        ok: true,
        action: "dry_run",
        ownerWorkspaceId,
        e164,
        provider,
        bootstrapNote:
          provider === "telnyx"
            ? "Would adopt Telnyx TFN via adoptMctbPlatformSenderFromTelnyxAccount."
            : "Would adopt parent-account TFN via adoptMctbPlatformSenderFromParentAccount.",
      }),
    );
    return;
  }

  if (provider === "telnyx") {
    const result = await adoptMctbPlatformSenderFromTelnyxAccount({
      ownerWorkspaceId,
      e164,
    });
    console.log(
      JSON.stringify({
        ok: true,
        provider: "telnyx",
        action: result.action,
        phoneNumberId: result.phoneNumberId,
        e164: result.e164,
        workspaceId: result.workspaceId,
        telnyxProviderNumberId: result.telnyxProviderNumberId,
        messagingProfileId: result.messagingProfileId,
        nextSteps: [
          `Set MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=${result.phoneNumberId}`,
          "Restart/redeploy application so resolveCanonicalMctbPlatformSender() resolves this row",
          "Telnyx messaging profile must POST to /api/telnyx/messaging (already on shared profiles)",
        ],
      }),
    );
    return;
  }

  const result = await adoptMctbPlatformSenderFromParentAccount({
    ownerWorkspaceId,
    e164,
  });

  console.log(
    JSON.stringify({
      ok: true,
      provider: "twilio",
      action: result.action,
      phoneNumberId: result.phoneNumberId,
      e164: result.e164,
      workspaceId: result.workspaceId,
      twilioSid: result.twilioSid,
      nextSteps: [
        `Set MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=${result.phoneNumberId}`,
        "Restart/redeploy application so resolveCanonicalMctbPlatformSender() resolves this row",
        "Configure Twilio SMS webhooks on the parent-owned TFN",
      ],
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
