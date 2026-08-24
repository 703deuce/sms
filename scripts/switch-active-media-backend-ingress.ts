#!/usr/bin/env npx tsx
/**
 * Point Telnyx SIP ingress + LiveKit trunks at the active MEDIA_BACKEND_MODE backend.
 *
 * Run on production after setting MEDIA_BACKEND_MODE=self_hosted and LIVEKIT_SELF_HOSTED_*.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-active-media-backend-ingress.ts
 *   ... --apply          # mutate Telnyx FQDN + re-provision numbers
 *   ... --e164 +15714073615
 */
import { getPrisma } from "@/lib/db";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  resolveAuthoritativeLiveKitSipHost,
} from "@/lib/voice/media-backend";
import {
  ensureNumberProvisioned,
  ensureTelnyxLiveKitFqdnConnection,
} from "@/lib/telephony/provisioning";

const apply = process.argv.includes("--apply");
const e164Arg = process.argv.find((a) => a.startsWith("+")) || null;

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const sip = resolveAuthoritativeLiveKitSipHost();

  console.log(
    JSON.stringify(
      {
        apply,
        mediaBackend: backend,
        livekitUrl: cfg.url,
        sipHost: sip.host,
        sipHostSource: sip.source,
        inboundTrunkId: cfg.inboundTrunkId,
        outboundTrunkId: cfg.outboundTrunkId,
        dispatchRuleId: cfg.dispatchRuleId,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nDry run — pass --apply to repoint Telnyx FQDN and re-provision numbers.");
    return;
  }

  const telnyx = await ensureTelnyxLiveKitFqdnConnection();
  console.log("\nTelnyx FQDN:", telnyx);

  const prisma = getPrisma();
  const phones = e164Arg
    ? await prisma.phoneNumber.findMany({
        where: { e164: e164Arg, status: { not: "released" } },
        select: { id: true, e164: true, workspaceId: true },
      })
    : await prisma.phoneNumber.findMany({
        where: {
          status: { not: "released" },
          routingMode: "livekit_sip",
        },
        select: { id: true, e164: true, workspaceId: true },
      });

  if (!phones.length) {
    throw new Error(e164Arg ? `No active number for ${e164Arg}` : "No LiveKit-routed numbers found");
  }

  for (const phone of phones) {
    const result = await ensureNumberProvisioned({
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      routingMode: "livekit_sip",
    });
    console.log(`\n${phone.e164}:`, JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
