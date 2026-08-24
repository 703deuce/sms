#!/usr/bin/env npx tsx
/**
 * Verify self-hosted provisioning path uses active env trunk IDs (dry-run).
 * Does not buy numbers or mutate LiveKit/Telnyx.
 */
import { SipClient } from "livekit-server-sdk";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  isMediaBackendConfigured,
} from "@/lib/voice/media-backend";
import { ensureInboundTrunkForNumber } from "@/lib/telephony/provisioning/livekit/trunk";

const FROZEN_TRUNK = "ST_acZETLdoDQ8o";
const STALE_TRUNK = "ST_9v6jM2L5ktzr";
const apply = process.argv.includes("--apply");
const testE164 = process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const envTrunk = cfg.inboundTrunkId || "";

  const report: Record<string, unknown> = {
    backend,
    envInboundTrunkId: envTrunk,
    frozenExpected: FROZEN_TRUNK,
    staleTrunk: STALE_TRUNK,
    envMatchesFrozen: envTrunk === FROZEN_TRUNK,
    envIsStale: envTrunk === STALE_TRUNK,
  };

  if (!isMediaBackendConfigured(backend)) {
    console.log(JSON.stringify({ ...report, ok: false, error: "backend_not_configured" }, null, 2));
    process.exit(1);
  }

  const client = new SipClient(apiUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  const trunks = await client.listSipInboundTrunk();
  const live571 = trunks.find((t) => (t.numbers || []).includes(testE164));
  report.live571TrunkId = live571?.sipTrunkId || null;
  report.envMatchesLive571 = envTrunk === live571?.sipTrunkId;

  if (apply) {
    const result = await ensureInboundTrunkForNumber(testE164, { backend });
    report.provisionDryRun = {
      trunkId: result.trunk.sipTrunkId,
      actions: result.actions,
      numbers: result.trunk.numbers,
    };
    report.provisionUsesEnvTrunk = result.trunk.sipTrunkId === envTrunk;
  } else {
    report.note = "Pass --apply to exercise ensureInboundTrunkForNumber without buying numbers";
  }

  const ok =
    envTrunk === FROZEN_TRUNK &&
    live571?.sipTrunkId === FROZEN_TRUNK &&
    envTrunk === live571?.sipTrunkId;

  console.log(JSON.stringify({ ...report, ok }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
