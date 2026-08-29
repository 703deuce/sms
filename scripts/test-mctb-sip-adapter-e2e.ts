#!/usr/bin/env npx tsx
/**
 * End-to-end MCTB SIP adapter checks without a PSTN call.
 *
 *   npm run test:mctb-sip-adapter-e2e
 *
 * Gates:
 *  1. Telnyx FQDN + 866 assignment + late-media flags
 *  2. voice-runtime HTTP (resolve session for 866)
 *  3. SIP OPTIONS/INVITE probe to voice.transovo.ai:5070 (Asterisk must answer)
 */
import { createSocket } from "node:dgram";
import { randomBytes } from "node:crypto";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_SIP_FQDN_CONNECTION_ID, MCTB_FQDN_DIRECT_TEST_E164 } from "@/lib/mctb/sip-diagnostic/constants";
import { ensureMctb571SipFqdnLateMediaSettings } from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import { LIVEKIT_SELF_HOSTED_SIP_HOST } from "@/lib/voice/media-backend/constants";
import { voiceRuntimeInternalSecret } from "@/lib/voice/python-runtime-bridge/auth";

const SIP_HOST = process.env.MCTB_SIP_ADAPTER_HOST || LIVEKIT_SELF_HOSTED_SIP_HOST;
const SIP_PORT = Number(process.env.MCTB_SIP_UDP_PORT || 5070);
const TEST_E164 = process.env.MCTB_SIP_TEST_E164 || MCTB_FQDN_DIRECT_TEST_E164;
const BACKEND_URL = (process.env.TRANSOVO_BACKEND_URL || process.env.APP_URL || "").replace(/\/$/, "");

type GateResult = { name: string; ok: boolean; detail: string };

const results: GateResult[] = [];

function gate(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function sipProbe(method: string, requestUri: string, extraHeaders: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    const branch = `z9hG4bK-${randomBytes(8).toString("hex")}`;
    const callId = `${randomBytes(8).toString("hex")}@mctb-e2e`;
    const fromTag = randomBytes(4).toString("hex");
    const lines = [
      `${method} ${requestUri} SIP/2.0`,
      `Via: SIP/2.0/UDP 127.0.0.1:15060;branch=${branch};rport`,
      "Max-Forwards: 70",
      `From: <sip:+15550009999@${SIP_HOST}>;tag=${fromTag}`,
      `To: <sip:${TEST_E164}@${SIP_HOST}>`,
      `Call-ID: ${callId}`,
      "CSeq: 1 " + method,
      "Contact: <sip:probe@127.0.0.1:15060>",
      "User-Agent: Transovo-MCTB-E2E-Probe",
      "Content-Length: 0",
      ...extraHeaders,
      "",
      "",
    ];
    const message = Buffer.from(lines.join("\r\n"), "utf8");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`${method} timeout — no UDP response on ${SIP_HOST}:${SIP_PORT}`));
    }, 5000);

    socket.on("message", (buf) => {
      clearTimeout(timer);
      socket.close();
      resolve(buf.toString("utf8"));
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });

    socket.send(message, SIP_PORT, SIP_HOST, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.close();
        reject(err);
      }
    });
  });
}

function sipStatus(response: string): number {
  const m = response.match(/^SIP\/2\.0 (\d{3})/m);
  return m ? Number(m[1]) : 0;
}

async function gateTelnyx() {
  const late = await ensureMctb571SipFqdnLateMediaSettings(MCTB_571_SIP_FQDN_CONNECTION_ID);
  gate(
    "telnyx_late_media",
    late.audit.lateMediaReady,
    `3PCC=${late.audit.thirdPartyControlEnabled} PRACK=${late.audit.prackEnabled} ringback=${late.audit.generateRingbackTone}`,
  );

  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  const primary = (fqdns.data || []).find((r) => String(r.id) === primaryId);
  const fqdnOk =
    String(primary?.fqdn || "").toLowerCase() === SIP_HOST.toLowerCase() &&
    Number(primary?.port || 0) === SIP_PORT;
  gate(
    "telnyx_fqdn_destination",
    fqdnOk,
    `primary=${String(primary?.fqdn)}:${String(primary?.port)} (want ${SIP_HOST}:${SIP_PORT})`,
  );

  const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": TEST_E164, "page[size]": 1 },
  });
  const onFqdn = String(pn.data?.[0]?.connection_id || "") === MCTB_571_SIP_FQDN_CONNECTION_ID;
  gate(
    "telnyx_866_on_fqdn",
    onFqdn,
    `${TEST_E164} → ${String(pn.data?.[0]?.connection_name || "unknown")} (${String(pn.data?.[0]?.connection_id || "")})`,
  );
}

async function gateVoiceRuntime() {
  const secret = voiceRuntimeInternalSecret();
  if (!secret || !BACKEND_URL) {
    gate("voice_runtime_http", false, "TRANSOVO_BACKEND_URL or internal API key missing");
    return;
  }

  const health = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
  gate("transovo_web_health", health.ok, `GET /api/health → ${health.status}`);

  const res = await fetch(`${BACKEND_URL}/api/internal/voice-runtime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "resolve_mctb_sip_session",
      payload: {
        callerE164: "+15550001001",
        transovoNumberE164: TEST_E164,
        diversionHeader: `<sip:+15405551234@one.att.net;user=phone>;reason=no-answer`,
        sipAttributes: { "sip.h.diversion": "test" },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = (await res.json()) as Record<string, unknown>;
  const ok = res.ok && body.ok === true && typeof body.playUrl === "string" && body.playUrl.length > 0;
  gate(
    "voice_runtime_resolve_session",
    ok,
    ok
      ? `workspace=${body.workspaceId} playUrl=${String(body.playUrl).slice(0, 60)}…`
      : `HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
  );
}

async function gateSipProbe() {
  const requestUri = `sip:${TEST_E164.replace("+", "")}@${SIP_HOST}:${SIP_PORT}`;

  let options = "";
  try {
    options = await sipProbe("OPTIONS", `sip:${SIP_HOST}:${SIP_PORT}`);
  } catch (err) {
    gate("sip_options_reachable", false, err instanceof Error ? err.message : String(err));
    gate("sip_invite_not_404", false, "skipped — OPTIONS failed");
    gate("sip_server_is_asterisk", false, "skipped — OPTIONS failed");
    return;
  }

  const optionsStatus = sipStatus(options);
  gate(
    "sip_options_reachable",
    optionsStatus >= 200 && optionsStatus < 500,
    `SIP ${optionsStatus} from ${SIP_HOST}:${SIP_PORT}`,
  );
  const asteriskUa = /asterisk/i.test(options);
  gate("sip_server_is_asterisk", asteriskUa, asteriskUa ? "Asterisk User-Agent seen" : options.split("\r\n").slice(0, 8).join(" | "));

  let invite = "";
  try {
    invite = await sipProbe("INVITE", requestUri, [
      "Allow: INVITE, ACK, CANCEL, OPTIONS, BYE",
      "Content-Type: application/sdp",
      "Content-Length: 0",
    ]);
  } catch (err) {
    gate("sip_invite_not_404", false, err instanceof Error ? err.message : String(err));
    return;
  }

  const inviteStatus = sipStatus(invite);
  // From non-Telnyx IP we may get 403/404 if identify is strict — but NOT 404 UNALLOCATED from wrong process.
  // Healthy: 100 Trying, 180, 183, or 401/403 (auth). Bad: 404 with no Asterisk, or timeout.
  const healthy =
    inviteStatus === 100 ||
    inviteStatus === 180 ||
    inviteStatus === 183 ||
    inviteStatus === 401 ||
    inviteStatus === 403 ||
    inviteStatus === 488;
  gate(
    "sip_invite_not_404",
    inviteStatus !== 404,
    `INVITE → SIP ${inviteStatus}${inviteStatus === 404 ? " (disconnected / no dialplan — this is the carrier symptom)" : ""}`,
  );
  if (!healthy && inviteStatus !== 404) {
    gate("sip_invite_progress", false, `unexpected ${inviteStatus}`);
  } else if (inviteStatus !== 404) {
    gate("sip_invite_progress", true, `got ${inviteStatus}`);
  }
}

async function main() {
  console.log(`\nMCTB SIP adapter E2E — ${SIP_HOST}:${SIP_PORT} test=${TEST_E164}\n`);
  await gateTelnyx();
  await gateVoiceRuntime();
  await gateSipProbe();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} gates passed`);
  if (failed.length) {
    console.error("\nFailed gates:");
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nOK mctb-sip-adapter-e2e");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
