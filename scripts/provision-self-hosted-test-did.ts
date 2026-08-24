import { ensureNumberProvisioned } from "../src/lib/telephony/provisioning/number-assignment";

async function main() {
  process.env.MEDIA_BACKEND_MODE = "self_hosted";
  const result = await ensureNumberProvisioned({
    workspaceId: "cmsi5cc2f156i0q0v38434g4l",
    phoneNumberId: "cmsi5ckis2x2s5u3c6h3j3w3i",
    agentId: "cmsi5cwyj04061t0n4l3s2g52",
    routingMode: "livekit_sip",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
