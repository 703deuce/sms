#!/usr/bin/env npx tsx
/**
 * Align phoneNumber.settingsJson telephony trunk/dispatch IDs with active MEDIA_BACKEND_MODE env.
 * Does not mutate LiveKit or Telnyx — DB metadata only (fixes stale ST_9v6j… in settingsJson).
 *
 * Usage:
 *   npx tsx scripts/sync-phone-livekit-trunk-ids-from-env.ts
 *   npx tsx scripts/sync-phone-livekit-trunk-ids-from-env.ts --e164 +15714073615 --apply
 */
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getActiveMediaBackend, getLiveKitBackendConfig } from "@/lib/voice/media-backend";

const apply = process.argv.includes("--apply");
const e164 =
  process.argv.find((a, i) => a === "--e164" && process.argv[i + 1]) &&
  process.argv[process.argv.indexOf("--e164") + 1]
    ? process.argv[process.argv.indexOf("--e164") + 1]
    : process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164, status: { not: "released" } },
    select: { id: true, e164: true, workspaceId: true, settingsJson: true },
  });
  if (!phone) throw new Error(`No active phone number for ${e164}`);

  const settings = asRecord(phone.settingsJson);
  const telephony = asRecord(settings.telephony);
  const before = {
    livekitInboundTrunkId: telephony.livekitInboundTrunkId ?? null,
    livekitDispatchRuleId: telephony.livekitDispatchRuleId ?? null,
    livekitOutboundTrunkId: telephony.livekitOutboundTrunkId ?? null,
    mediaBackend: telephony.mediaBackend ?? null,
  };
  const after = {
    livekitInboundTrunkId: cfg.inboundTrunkId,
    livekitDispatchRuleId: cfg.dispatchRuleId,
    livekitOutboundTrunkId: cfg.outboundTrunkId,
    mediaBackend: backend,
  };

  const plan = { apply, e164: phone.e164, phoneNumberId: phone.id, backend, before, after };
  console.log(JSON.stringify(plan, null, 2));

  const unchanged =
    before.livekitInboundTrunkId === after.livekitInboundTrunkId &&
    before.livekitDispatchRuleId === after.livekitDispatchRuleId &&
    before.livekitOutboundTrunkId === after.livekitOutboundTrunkId &&
    before.mediaBackend === after.mediaBackend;

  if (unchanged) {
    console.log("\nPhone settingsJson already matches env — no update needed.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — pass --apply to update settingsJson.");
    return;
  }

  const mergedTelephony = {
    ...telephony,
    ...after,
    routingMode: telephony.routingMode || "livekit_sip",
  };
  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      settingsJson: {
        ...settings,
        telephony: mergedTelephony,
      } as object,
    },
  });
  console.log("\nUpdated phone settingsJson telephony trunk IDs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
