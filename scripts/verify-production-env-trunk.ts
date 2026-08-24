#!/usr/bin/env npx tsx
/**
 * Verify production env trunk ID matches the frozen working self-hosted trunk.
 * Run after Coolify deploy on transovo-web and transovo-voice.
 */
import { SipClient } from "livekit-server-sdk";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  isMediaBackendConfigured,
} from "@/lib/voice/media-backend";

const FROZEN_TRUNK = "ST_acZETLdoDQ8o";
const STALE_TRUNK = "ST_9v6jM2L5ktzr";

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const envTrunk = cfg.inboundTrunkId || "";

  let live571: string | null = null;
  if (isMediaBackendConfigured("self_hosted")) {
    const selfCfg = getLiveKitBackendConfig("self_hosted");
    const client = new SipClient(apiUrl(selfCfg.url), selfCfg.apiKey, selfCfg.apiSecret);
    const trunks = await client.listSipInboundTrunk();
    live571 = trunks.find((t) => (t.numbers || []).includes(MCTB_PLATFORM_DEMO_E164))?.sipTrunkId || null;
  }

  const issues: string[] = [];
  if (backend !== "self_hosted") issues.push("MEDIA_BACKEND_MODE is not self_hosted");
  if (envTrunk === STALE_TRUNK) {
    issues.push(`LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID is stale (${STALE_TRUNK})`);
  }
  if (envTrunk && envTrunk !== FROZEN_TRUNK && live571 === FROZEN_TRUNK) {
    issues.push(`env trunk ${envTrunk} does not match live 571 trunk ${FROZEN_TRUNK}`);
  }
  if (live571 && live571 !== FROZEN_TRUNK) {
    issues.push(`live 571 trunk is ${live571}, expected ${FROZEN_TRUNK}`);
  }

  const result = {
    ok: issues.length === 0,
    mediaBackendMode: process.env.MEDIA_BACKEND_MODE || "livekit_cloud",
    resolvedBackend: backend,
    envInboundTrunkId: envTrunk || null,
    live571TrunkId: live571,
    frozenExpected: FROZEN_TRUNK,
    issues,
    fix:
      issues.length > 0
        ? "Set LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=ST_acZETLdoDQ8o on transovo-web AND transovo-voice, redeploy both"
        : null,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
