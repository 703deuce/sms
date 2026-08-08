#!/usr/bin/env node
/**
 * Backend SIP/LiveKit diagnostics for +18663464256 (production).
 * Usage: node scripts/livekit-sip-backend-test.mjs
 */
import {
  api,
  smokeLogin,
  getProductionBase,
} from "./lib/smoke-production.mjs";

const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const E164 = (process.env.PHONE_E164 || "+18663464256").trim();

async function telnyxCdr() {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) return { ok: false, error: "TELNYX_API_KEY missing" };
  const res = await fetch(
    "https://api.telnyx.com/v2/detail_records?filter[record_type]=sip-trunking&page[size]=5",
    { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } },
  );
  const json = await res.json();
  const rows = (json.data || []).filter((r) => String(r.cld || "").includes("8663464256"));
  return { ok: true, latest: rows[0] || null };
}

async function sipTcpPing(host) {
  const { execSync } = await import("node:child_process");
  try {
    const out = execSync(
      `timeout 3 bash -c 'echo -e "OPTIONS sip:${host} SIP/2.0\\r\\nVia: SIP/2.0/TCP 127.0.0.1:5060\\r\\nFrom: <sip:probe@test>\\r\\nTo: <sip:probe@${host}>\\r\\nCall-ID: probe@local\\r\\nCSeq: 1 OPTIONS\\r\\nContent-Length: 0\\r\\n\\r\\n" | nc -w 2 ${host} 5060'`,
      { encoding: "utf8" },
    );
    return { ok: /SIP\/2.0 200/.test(out), sample: out.split("\r\n")[0] };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

async function main() {
  const report = { steps: [] };
  const BASE = getProductionBase();
  console.log("=== LiveKit SIP backend test ===\nTarget:", BASE, "\nDID:", E164);

  const cdr = await telnyxCdr();
  report.steps.push({ step: "telnyx_cdr", ...cdr });
  console.log("\nTelnyx latest CDR:", cdr.latest
    ? `${cdr.latest.started_at} ${cdr.latest.hangup_cause} sip=${cdr.latest.sip_invite_failure_status} conn=${cdr.latest.connection_name}`
    : "(none)");

  const { jar } = await smokeLogin();
  const inspect = await api(jar, BASE, "POST", "/api/voice/livekit/readiness", {
    phoneNumberId: PHONE_866_ID,
    inspect: true,
  });
  report.steps.push({ step: "livekit_inspect", status: inspect.status, data: inspect.json?.data });
  const sipHost = inspect.json?.data?.inspect?.sipHost || inspect.json?.data?.sipHost?.host;
  console.log("\nLiveKit inspect:", JSON.stringify(inspect.json?.data?.inspect || inspect.json?.data, null, 2));

  if (sipHost) {
    const ping = await sipTcpPing(sipHost);
    report.steps.push({ step: "sip_tcp_options", host: sipHost, ...ping });
    console.log("\nSIP OPTIONS", sipHost, ping.ok ? "OK" : "FAIL", ping.sample || ping.error || "");
  }

  const mode = process.env.SIP_TEST_ACTION || "fullReset";
  if (mode === "restoreTexml") {
    const texml = await api(jar, BASE, "POST", "/api/voice/livekit/readiness", {
      phoneNumberId: PHONE_866_ID,
      agentId: AMY_AGENT_ID,
      restoreTexml: true,
    });
    report.steps.push({ step: "restore_texml", status: texml.status, data: texml.json?.data });
    console.log("\nTeXML restore:", JSON.stringify(texml.json?.data?.texmlRestore, null, 2));
  } else if (mode === "fullReset") {
    const reset = await api(jar, BASE, "POST", "/api/voice/livekit/readiness", {
      phoneNumberId: PHONE_866_ID,
      agentId: AMY_AGENT_ID,
      fullReset: true,
    });
    report.steps.push({ step: "full_reset", status: reset.status, data: reset.json?.data });
    console.log("\nFull reset:", JSON.stringify(reset.json?.data?.repair, null, 2));
  }

  console.log("\n=== REPORT ===");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
