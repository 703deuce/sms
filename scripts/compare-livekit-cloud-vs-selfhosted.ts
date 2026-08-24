#!/usr/bin/env npx tsx
/** Compare cloud vs self-hosted LiveKit SIP config for 571. */
import { SipClient } from "livekit-server-sdk";
import { getLiveKitBackendConfig } from "@/lib/voice/media-backend/config";

const E164 = "+15714073615";

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

async function snapshot(backend: "livekit_cloud" | "self_hosted") {
  const cfg = getLiveKitBackendConfig(backend);
  const client = new SipClient(apiUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  const trunks = await client.listSipInboundTrunk();
  const rules = await client.listSipDispatchRule();
  return {
    backend,
    url: cfg.url,
    sipHost: cfg.sipHost,
    inboundTrunkId: cfg.inboundTrunkId,
    dispatchRuleId: cfg.dispatchRuleId,
    trunks: trunks.map((t) => ({
      id: t.sipTrunkId,
      name: t.name,
      numbers: t.numbers,
      allowed: (t as { allowedAddresses?: string[] }).allowedAddresses || [],
      auth: Boolean((t as { authUsername?: string }).authUsername),
    })),
    rules: rules.map((r) => ({
      id: r.sipDispatchRuleId,
      name: r.name,
      trunkIds: r.trunkIds,
      agent: r.roomConfig?.agents?.[0]?.agentName,
    })),
    trunkFor571: trunks.find((t) => (t.numbers || []).some((n) => n.includes("5714073615"))),
  };
}

async function main() {
  const cloud = await snapshot("livekit_cloud");
  const self = await snapshot("self_hosted");
  console.log(JSON.stringify({ cloud, self }, null, 2));
  console.log("\n571 on cloud:", cloud.trunkFor571?.sipTrunkId || "NOT FOUND");
  console.log("571 on self:", self.trunkFor571?.sipTrunkId || "NOT FOUND");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
