import {
  getLiveKitProjectAlignment,
  normalizeLiveKitSipHost,
  resolveLiveKitSipHost,
  resolveTelnyxIngressLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";
import { requireLiveKitEnv } from "../src/lib/voice/runtime-provider/config";
import { SipClient } from "livekit-server-sdk";

const TARGET =
  process.env.LIVEKIT_SIP_URI?.trim().replace(/^sip:/, "").split("/")[0] ||
  process.env.LIVEKIT_SIP_HOST?.trim() ||
  "";

async function main() {
  console.log("LIVEKIT_URL host:", normalizeLiveKitSipHost(process.env.LIVEKIT_URL || ""));
  console.log("LIVEKIT_SIP_URI host:", normalizeLiveKitSipHost(process.env.LIVEKIT_SIP_URI || ""));
  console.log("target:", TARGET);
  console.log("alignment:", getLiveKitProjectAlignment());
  console.log("ingress (current):", resolveTelnyxIngressLiveKitSipHost());
  console.log("resolveLiveKitSipHost:", resolveLiveKitSipHost());

  const { url, apiKey, apiSecret } = requireLiveKitEnv();
  console.log("API url:", url);
  const lk = new SipClient(url, apiKey, apiSecret);
  const trunks = await lk.listSipInboundTrunk();
  console.log(
    "trunks:",
    trunks.map((t) => ({ id: t.sipTrunkId, name: t.name, numbers: t.numbers })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
