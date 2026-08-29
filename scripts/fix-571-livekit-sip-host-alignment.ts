/**
 * Fix 571 "not in service": Telnyx primary FQDN must match LIVEKIT_URL project SIP host.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/fix-571-livekit-sip-host-alignment.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  getLiveKitProjectAlignment,
  resolveTelnyxIngressLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";
import { ensureTelnyxLiveKitFqdnConnection } from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import {
  ensureNumberProvisioned,
  repairLiveKitSipRouting,
} from "../src/lib/telephony/provisioning";

const E164 = "+15714073615";
const WORKSPACE_ID = "ws_1";
const PHONE_NUMBER_ID = "cmsgtjms84g6l2h0o255w1e3v";
const AGENT_ID = "cmsdkcnwr5p3i5s0h3i1x0j60";

async function main() {
  const alignment = getLiveKitProjectAlignment();
  const ingress = resolveTelnyxIngressLiveKitSipHost();
  console.log("LiveKit alignment:", alignment);
  console.log("Telnyx ingress host:", ingress);

  console.log("\nEnsuring Telnyx FQDN points at API-aligned SIP host...");
  const fqdn = await ensureTelnyxLiveKitFqdnConnection();
  console.log("FQDN actions:", fqdn.actions);

  console.log("\nRebuilding LiveKit SIP trunk on API project...");
  const repair = await repairLiveKitSipRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    agentId: AGENT_ID,
  });
  console.log(
    JSON.stringify(
      {
        ok: repair.ok,
        trunkId: repair.after.trunkContainingDid?.id,
        trunkNumbers: repair.after.trunkContainingDid?.numbers,
        dispatch: repair.after.dispatchRulesForTrunk,
      },
      null,
      2,
    ),
  );

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { publishedVersionId: true },
  });
  await ensureNumberProvisioned({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    agentId: AGENT_ID,
    routingMode: "livekit_sip",
    publishedVersionId: agent?.publishedVersionId,
  });

  const verifyConn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(fqdn.connectionId)}`,
  );
  const primaryId = String(
    (verifyConn.data?.inbound as Record<string, unknown> | undefined)
      ?.default_primary_fqdn_id || "",
  );
  const fqdnRows = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": fqdn.connectionId },
  });
  const primaryFqdn = (fqdnRows.data || []).find((r) => String(r.id) === primaryId);
  console.log("\n=== FIXED ===");
  console.log(`Call ${E164}`);
  console.log(`Telnyx now routes to: ${primaryFqdn?.fqdn || ingress.host}`);
  console.log(`LiveKit trunk: ${repair.after.trunkContainingDid?.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
