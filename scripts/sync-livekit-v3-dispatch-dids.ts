/**
 * Re-stamp LiveKit SIP dispatch to transovo-voice-v3 for known DIDs (metadata only).
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/sync-livekit-v3-dispatch-dids.ts
 */
import { ensureNumberProvisioned } from "@/lib/telephony/provisioning";

const cases = [
  {
    label: "wizard3615",
    workspaceId: process.env.WORKSPACE_ID || "ws_1",
    phoneNumberId: process.env.WIZARD_PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v",
    agentId: process.env.WIZARD_AGENT_ID || "cmu42zyel1c4x01090c6s335z",
  },
  {
    label: "cert1060",
    workspaceId: process.env.WORKSPACE_ID || "ws_1",
    phoneNumberId: process.env.CERT_PHONE_ID || "cmtokonyy57004g58242i4c2o",
    agentId: process.env.CERT_AGENT_ID || "cmshz2lc25c622c4i58303501",
  },
];

async function main() {
  for (const c of cases) {
    const result = await ensureNumberProvisioned({
      workspaceId: c.workspaceId,
      phoneNumberId: c.phoneNumberId,
      agentId: c.agentId,
      routingMode: "livekit_sip",
      dispatchMetadataOnly: true,
    });
    console.log(
      JSON.stringify({
        label: c.label,
        ok: result.ok,
        e164: result.e164,
        actions: result.actions,
        error: result.error,
      }),
    );
    if (!result.ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
