/**
 * Diagnose why +15714073615 returns "not in service" on PSTN.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diagnose-571-not-in-service.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  getAuthoritativeLiveKitSipHost,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
} from "../src/lib/telephony/provisioning/config";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
} from "../src/lib/telephony/provisioning/livekit/inspect";
import { verifyNumberRouting, repairLiveKitSipRouting } from "../src/lib/telephony/provisioning";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const E164 = process.env.PHONE_E164 || "+15714073615";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";
const APPLY_FIX = process.argv.includes("--repair");

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_NUMBER_ID, workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      e164: true,
      status: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
  if (!phone) throw new Error("ws_1 phone row not found");

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164, "page[size]": 5 } },
  );
  const telnyxPn = listed.data?.[0];
  const connId = String(telnyxPn?.connection_id || "");
  const fqdnConn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const fqdns = connId
    ? await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
        query: { "filter[connection_id]": connId },
      })
    : { data: [] };

  const sipHost = getAuthoritativeLiveKitSipHost();
  const inspect = await inspectLiveKitSipRouting(E164);
  const livekitIssues = diagnoseLiveKitSipIssues(inspect, E164);
  const verify = await verifyNumberRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
  });

  const voice = telnyxPn?.id
    ? await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/phone_numbers/${encodeURIComponent(String(telnyxPn.id))}/voice`,
      ).catch(() => null)
    : null;

  const report = {
    e164: E164,
    dbPhone: phone,
    telnyx: telnyxPn
      ? {
          id: telnyxPn.id,
          status: telnyxPn.status,
          phone_number: telnyxPn.phone_number,
          connection_id: telnyxPn.connection_id,
          connection_name: telnyxPn.connection_name,
          messaging_profile_id: telnyxPn.messaging_profile_id,
        }
      : null,
    voiceSettings: voice?.data || null,
    expectedFqdnConnectionId: fqdnConn?.id || null,
    onCorrectConnection: connId === String(fqdnConn?.id || ""),
    sipHost,
    fqdnsOnLiveConnection: (fqdns.data || []).map((f) => ({
      id: f.id,
      fqdn: f.fqdn,
      port: f.port,
      matchesLiveKitHost:
        String(f.fqdn || "").toLowerCase() === sipHost.host.toLowerCase(),
    })),
    livekit: {
      trunk: inspect.trunkContainingDid,
      dispatchRules: inspect.dispatchRulesForTrunk,
      issues: livekitIssues,
    },
    verify,
  };

  console.log(JSON.stringify(report, null, 2));

  const blockers: string[] = [];
  if (!telnyxPn) blockers.push("number_not_in_telnyx_account");
  if (telnyxPn && String(telnyxPn.status).toLowerCase() !== "active") {
    blockers.push(`telnyx_status_${telnyxPn.status}`);
  }
  if (!report.onCorrectConnection) blockers.push("wrong_telnyx_connection");
  const fqdnMatch = report.fqdnsOnLiveConnection.some((f) => f.matchesLiveKitHost);
  if (!fqdnMatch) blockers.push("fqdn_host_mismatch");
  if (livekitIssues.length) blockers.push(...livekitIssues);
  if (!verify.ok) blockers.push(...verify.issues);

  console.log("\n=== BLOCKERS ===");
  console.log(blockers.length ? blockers.join("\n") : "none detected in API audit");

  if (APPLY_FIX) {
    console.log("\n=== REPAIR ===");
    const repair = await repairLiveKitSipRouting({
      workspaceId: WORKSPACE_ID,
      phoneNumberId: PHONE_NUMBER_ID,
      agentId: AGENT_ID,
    });
    console.log(JSON.stringify(repair, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
