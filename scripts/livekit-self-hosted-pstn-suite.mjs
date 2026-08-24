#!/usr/bin/env node
/**
 * Operational PSTN + failover suite for self-hosted LiveKit.
 * Safe audit — never prints secret values.
 *
 * Usage:
 *   node scripts/livekit-self-hosted-pstn-suite.mjs audit
 *   node scripts/livekit-self-hosted-pstn-suite.mjs route-test-did
 *   node scripts/livekit-self-hosted-pstn-suite.mjs inbound-call
 *   node scripts/livekit-self-hosted-pstn-suite.mjs outbound-sip-participant
 *   node scripts/livekit-self-hosted-pstn-suite.mjs enable-failover
 *   node scripts/livekit-self-hosted-pstn-suite.mjs verify-failover-config
 *   node scripts/livekit-self-hosted-pstn-suite.mjs sip-logs
 */
import { execSync } from "node:child_process";
import { SipClient, AgentDispatchClient } from "livekit-server-sdk";

const TEST_DID = (process.env.LIVEKIT_SELF_HOSTED_TEST_DID || "+18663221763").trim();
const OUTBOUND_TEST = process.env.OUTBOUND_TEST_PHONE?.trim() || "";

async function telnyx(path, opts = {}) {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) throw new Error("TELNYX_API_KEY missing");
  const url = `https://api.telnyx.com/v2${path}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Telnyx ${opts.method || "GET"} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function selfHostedClient() {
  const url = process.env.LIVEKIT_SELF_HOSTED_URL || "wss://voice.transovo.ai";
  const key = process.env.LIVEKIT_SELF_HOSTED_API_KEY;
  const secret = process.env.LIVEKIT_SELF_HOSTED_API_SECRET;
  if (!key || !secret) throw new Error("LIVEKIT_SELF_HOSTED_API_KEY/SECRET missing");
  return new SipClient(url, key, secret);
}

function cloudClient() {
  let url = process.env.LIVEKIT_URL || "";
  if (!url.includes("://")) url = `wss://${url}`;
  url = url.replace(/\.sip\.livekit\.cloud/i, ".livekit.cloud");
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new Error("LIVEKIT_API_KEY/SECRET missing");
  return new SipClient(url, key, secret);
}

function auditConfig() {
  const keys = [
    "LIVEKIT_SELF_HOSTED_URL",
    "LIVEKIT_SELF_HOSTED_API_KEY",
    "LIVEKIT_SELF_HOSTED_API_SECRET",
    "LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID",
    "LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID",
    "LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "TELNYX_API_KEY",
    "TELNYX_CONNECTION_ID",
    "OUTBOUND_TEST_PHONE",
    "LIVEKIT_AGENT_NAME",
    "MEDIA_BACKEND_MODE",
  ];
  const report = Object.fromEntries(
    keys.map((k) => [k, Boolean(process.env[k]?.trim())]),
  );
  report.TEST_DID = TEST_DID;
  report.OUTBOUND_TEST_SET = Boolean(OUTBOUND_TEST);
  console.log(JSON.stringify({ step: "config_audit", report }, null, 2));
  return report;
}

async function findTelnyxNumber(e164) {
  const res = await telnyx(`/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`);
  return res.data?.[0] || null;
}

async function routeTestDid() {
  const { ensureTelnyxFqdnConnectionForBackend } = await import(
    "../src/lib/voice/media-backend/telnyx-failover.ts"
  );
  const { routeTelnyxNumberToConnection } = await import(
    "../src/lib/telephony/provisioning/telnyx/sip-connection.ts"
  );

  const conn = await ensureTelnyxFqdnConnectionForBackend("self_hosted");
  const num = await findTelnyxNumber(TEST_DID);
  if (!num?.id) throw new Error(`Telnyx number ${TEST_DID} not found`);

  const before = await telnyx(`/phone_numbers/${num.id}`);
  const route = await routeTelnyxNumberToConnection({
    e164: TEST_DID,
    providerNumberId: String(num.id),
    connectionId: conn.connectionId,
  });

  const after = await telnyx(`/phone_numbers/${num.id}`);
  const fqdns = await telnyx(`/fqdns?filter[connection_id]=${conn.connectionId}`);

  console.log(
    JSON.stringify(
      {
        step: "route_test_did",
        testDid: TEST_DID,
        connectionId: conn.connectionId,
        connectionName:
          process.env.TELNYX_SELF_HOSTED_FQDN_CONNECTION_NAME ||
          "Transovo Self-Hosted LiveKit TEST",
        sipHost: conn.sipHost,
        fqdns: (fqdns.data || []).map((f) => ({
          id: f.id,
          fqdn: f.fqdn,
          port: f.port,
        })),
        previousConnectionId: route.previousConnectionId || before.data?.connection_id,
        currentConnectionId: after.data?.connection_id,
        actions: conn.actions,
      },
      null,
      2,
    ),
  );
}

async function placeInboundTestCall() {
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  const from = OUTBOUND_TEST || process.env.VOICE_TRANSFER_FALLBACK_E164?.trim();
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID missing");
  if (!from) throw new Error("OUTBOUND_TEST_PHONE or VOICE_TRANSFER_FALLBACK_E164 required");

  const snapBefore = await listRooms("self_hosted");
  const call = await telnyx("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      to: TEST_DID,
      from,
      timeout_secs: 45,
      client_state: Buffer.from(
        JSON.stringify({ purpose: "self_hosted_inbound_pstn_test", at: Date.now() }),
      ).toString("base64"),
    },
  });

  const callControlId = call.data?.call_control_id;
  console.log(
    JSON.stringify(
      {
        step: "inbound_call_placed",
        callControlId,
        from,
        to: TEST_DID,
        roomsBefore: snapBefore.length,
      },
      null,
      2,
    ),
  );

  await sleep(15000);
  const snapAfter = await listRooms("self_hosted");
  const cdr = await latestSipCdr(TEST_DID);
  const sipLogs = tailSipLogs(40);

  console.log(
    JSON.stringify(
      {
        step: "inbound_call_observation",
        roomsAfter: snapAfter.map((r) => ({
          name: r.name,
          numParticipants: Number(r.numParticipants ?? 0),
          creationTime: Number(r.creationTime ?? 0),
        })),
        newRooms: snapAfter.filter((r) => !snapBefore.some((b) => b.name === r.name)),
        telnyxCdr: cdr,
        sipLogTail: sipLogs,
      },
      null,
      2,
    ),
  );

  if (callControlId) {
    try {
      await telnyx(`/calls/${callControlId}/actions/hangup`, { method: "POST", body: {} });
    } catch {
      // may already be ended
    }
  }
}

async function outboundSipParticipantTest() {
  const trunkId = process.env.LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID?.trim();
  const dest = OUTBOUND_TEST;
  const from = TEST_DID;
  if (!trunkId || !dest) throw new Error("trunk id and OUTBOUND_TEST_PHONE required");

  const roomName = `transovo-outbound-selfhosted-test-${Date.now()}`;
  const client = selfHostedClient();
  const participant = await client.createSipParticipant(trunkId, dest, roomName, {
    fromNumber: from,
    waitUntilAnswered: false,
    playDialtone: true,
  });

  console.log(
    JSON.stringify(
      {
        step: "outbound_sip_participant_created",
        roomName,
        trunkId,
        from,
        to: dest,
        participantId: participant.participantId,
        sipCallId: participant.sipCallId,
      },
      null,
      2,
    ),
  );

  await sleep(20000);
  const cdr = await latestSipCdr(dest);
  const sipLogs = tailSipLogs(50);
  console.log(
    JSON.stringify({ step: "outbound_observation", telnyxCdr: cdr, sipLogTail: sipLogs }, null, 2),
  );

  try {
    const { RoomServiceClient } = await import("livekit-server-sdk");
    const url = process.env.LIVEKIT_SELF_HOSTED_URL || "wss://voice.transovo.ai";
    const rsc = new RoomServiceClient(
      url,
      process.env.LIVEKIT_SELF_HOSTED_API_KEY,
      process.env.LIVEKIT_SELF_HOSTED_API_SECRET,
    );
    await rsc.deleteRoom(roomName);
  } catch {
    // ignore
  }
}

async function enableFailover() {
  process.env.TELNYX_LIVEKIT_FAILOVER_ENABLED = "1";
  const { ensureTelnyxLiveKitInboundFailover } = await import(
    "../src/lib/voice/media-backend/telnyx-failover.ts"
  );
  const result = await ensureTelnyxLiveKitInboundFailover();
  console.log(JSON.stringify({ step: "enable_failover", ...result }, null, 2));
}

async function verifyFailoverConfig() {
  const name =
    process.env.TELNYX_LIVEKIT_FAILOVER_CONNECTION_NAME?.trim() ||
    "Transovo LiveKit Inbound Failover";
  const res = await telnyx("/fqdn_connections?page[size]=100");
  const conn = (res.data || []).find((r) => r.connection_name === name);
  if (!conn) {
    console.log(JSON.stringify({ step: "verify_failover", ok: false, error: "connection_not_found" }));
    return;
  }
  const detail = await telnyx(`/fqdn_connections/${conn.id}`);
  const inbound = detail.data?.inbound || {};
  const fqdns = await telnyx(`/fqdns?filter[connection_id]=${conn.id}`);
  const byId = Object.fromEntries((fqdns.data || []).map((f) => [String(f.id), f.fqdn]));
  console.log(
    JSON.stringify(
      {
        step: "verify_failover",
        ok: true,
        connectionId: conn.id,
        connectionName: name,
        primaryFqdn: byId[String(inbound.default_primary_fqdn_id)] || null,
        secondaryFqdn: byId[String(inbound.default_secondary_fqdn_id)] || null,
      },
      null,
      2,
    ),
  );
}

async function listRooms(backend) {
  const { RoomServiceClient } = await import("livekit-server-sdk");
  const url =
    backend === "self_hosted"
      ? process.env.LIVEKIT_SELF_HOSTED_URL || "wss://voice.transovo.ai"
      : process.env.LIVEKIT_URL;
  const key =
    backend === "self_hosted"
      ? process.env.LIVEKIT_SELF_HOSTED_API_KEY
      : process.env.LIVEKIT_API_KEY;
  const secret =
    backend === "self_hosted"
      ? process.env.LIVEKIT_SELF_HOSTED_API_SECRET
      : process.env.LIVEKIT_API_SECRET;
  const rsc = new RoomServiceClient(url, key, secret);
  return rsc.listRooms();
}

async function latestSipCdr(e164) {
  const digits = e164.replace(/\D/g, "");
  const res = await telnyx(
    "/detail_records?filter[record_type]=sip-trunking&page[size]=10",
  );
  const rows = (res.data || []).filter(
    (r) => String(r.cld || r.cli || "").replace(/\D/g, "").includes(digits.slice(-10)),
  );
  const row = rows[0];
  if (!row) return null;
  return {
    started_at: row.started_at,
    finished_at: row.finished_at,
    hangup_cause: row.hangup_cause,
    sip_invite_failure_status: row.sip_invite_failure_status,
    connection_name: row.connection_name,
    duration_secs: row.billed_sec || row.duration_secs,
    cli: row.cli,
    cld: row.cld,
  };
}

function tailSipLogs(lines = 30) {
  const host = process.env.LIVEKIT_SERVER_HOST;
  const user = process.env.LIVEKIT_SERVER_USER || "root";
  if (!host) return [];
  try {
    const out = execSync(
      `ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/transovo_livekit ${user}@${host} 'docker logs transovo-livekit-sip-1 --tail ${lines} 2>&1'`,
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    );
    return out.split("\n").filter(Boolean).slice(-lines);
  } catch (e) {
    return [`ssh_error: ${e.message}`];
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const cmd = process.argv[2] || "audit";
const handlers = {
  audit: auditConfig,
  "route-test-did": routeTestDid,
  "inbound-call": placeInboundTestCall,
  "outbound-sip-participant": outboundSipParticipantTest,
  "enable-failover": enableFailover,
  "verify-failover-config": verifyFailoverConfig,
  "sip-logs": async () => console.log(tailSipLogs(80).join("\n")),
};

(async () => {
  const fn = handlers[cmd];
  if (!fn) {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
  await fn();
})().catch((e) => {
  console.error(JSON.stringify({ error: e.message, body: e.body || null }));
  process.exit(1);
});
