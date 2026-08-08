#!/usr/bin/env node
/**
 * Live LiveKit integration test via production API + direct Telnyx/LiveKit checks.
 */
import {
  api,
  getProductionBase,
  smokeLogin,
} from "./lib/smoke-production.mjs";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();
const E164 = (process.env.PHONE_E164 || "+18663464256").trim();

async function main() {
  const BASE = getProductionBase();
  if (!BASE) throw new Error("Production BASE_URL not configured");

  const report = { steps: [], ok: true };

  console.log("=== LiveKit live integration test ===\n");
  console.log(`Target: ${BASE}`);
  console.log(`Amy: ${AMY_AGENT_ID} on ${E164}\n`);

  const { jar } = await smokeLogin();
  report.steps.push({ step: "smoke_login", ok: true });
  console.log("✓ smoke-login");

  // 2) Get Amy agent state
  const getAgent = await api(jar, BASE, "GET", `/api/voice/agents/${AMY_AGENT_ID}`);
  const agent = getAgent.json?.data;
  report.steps.push({
    step: "get_agent",
    ok: getAgent.status === 200,
    status: getAgent.status,
    rawStatus: agent?.rawStatus,
    phoneNumberId: agent?.phoneNumberId,
    healthStatus: agent?.healthStatus,
    healthMessage: agent?.healthMessage,
  });
  console.log(
    getAgent.status === 200
      ? `✓ get agent: status=${agent?.rawStatus} phone=${agent?.phoneNumberId}`
      : `✗ get agent: ${getAgent.status}`,
  );

  // 3) Assign phone if needed
  if (agent?.phoneNumberId !== PHONE_866_ID) {
    const patch = await api(jar, BASE, "PATCH", `/api/voice/agents/${AMY_AGENT_ID}`, {
      phoneNumberId: PHONE_866_ID,
      status: "ACTIVE",
    });
    report.steps.push({ step: "assign_phone", ok: patch.status === 200, status: patch.status });
    console.log(patch.status === 200 ? "✓ assigned 866 phone" : `✗ assign phone ${patch.status}`);
  } else {
    report.steps.push({ step: "assign_phone", ok: true, skipped: true });
    console.log("✓ phone already assigned");
  }

  // 4) LiveKit readiness API (production must have PR deployed)
  const lkReady = await api(jar, BASE, "GET", "/api/voice/livekit/readiness");
  report.steps.push({
    step: "livekit_readiness_api",
    ok: lkReady.status === 200,
    status: lkReady.status,
    data: lkReady.json?.data,
  });
  if (lkReady.status === 200) {
    console.log("✓ livekit readiness API");
    console.log(" ", JSON.stringify(lkReady.json?.data, null, 2));
  } else {
    console.log(`⚠ livekit readiness API not deployed yet (${lkReady.status})`);
  }

  // 5) Publish / deploy Amy (triggers LiveKit provision when VOICE_RUNTIME_PROVIDER=livekit on server)
  const publish = await api(jar, BASE, "PATCH", `/api/voice/agents/${AMY_AGENT_ID}`, {
    action: "publish",
  });
  const pubData = publish.json?.data || publish.json;
  report.steps.push({
    step: "publish_agent",
    ok: publish.status === 200,
    status: publish.status,
    livekitProvision: pubData?.livekitProvision || pubData?.deploy?.livekitProvision,
    texmlRoute: pubData?.texmlRoute,
    healthMessage: pubData?.agent?.healthMessage || pubData?.healthMessage,
    error: publish.json?.error,
  });
  if (publish.status === 200) {
    console.log("✓ publish agent");
    if (pubData?.livekitProvision) {
      console.log("  livekitProvision:", JSON.stringify(pubData.livekitProvision, null, 2));
    } else if (pubData?.texmlRoute) {
      console.log("  texmlRoute (Telnyx path):", pubData.texmlRoute?.path || pubData.texmlRoute);
    }
  } else {
    console.error("✗ publish failed", publish.status, JSON.stringify(publish.json, null, 2));
    report.ok = false;
  }

  // 6) Provision via API if readiness endpoint exists
  if (lkReady.status === 200) {
    const prov = await api(jar, BASE, "POST", "/api/voice/livekit/readiness", {
      phoneNumberId: PHONE_866_ID,
      agentId: AMY_AGENT_ID,
      provision: true,
    });
    report.steps.push({
      step: "livekit_provision_api",
      ok: prov.status === 200 && prov.json?.data?.provision?.ok !== false,
      status: prov.status,
      data: prov.json?.data,
    });
    if (prov.status === 200) {
      console.log("✓ livekit provision API");
      console.log(" ", JSON.stringify(prov.json?.data, null, 2));
    } else {
      console.error("✗ livekit provision API", prov.status, prov.json);
      report.ok = false;
    }
  }

  // 7) Telnyx routing check (local API key)
  if (process.env.TELNYX_API_KEY) {
    const key = process.env.TELNYX_API_KEY.trim();
    const tn = await fetch(
      `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(E164)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const tnJson = await tn.json();
    const row = tnJson.data?.[0];
    const connName = String(row?.connection_name || "");
    const isLiveKitFqdn = /livekit|transovo/i.test(connName) && !/AI Direct|texml/i.test(connName);
    const isTexml = /AI Direct|texml/i.test(connName);
    report.steps.push({
      step: "telnyx_routing",
      ok: true,
      connectionId: row?.connection_id,
      connectionName: connName,
      routeKind: isLiveKitFqdn ? "livekit_fqdn" : isTexml ? "telnyx_texml_assistant" : "other",
    });
    console.log(`\nTelnyx ${E164}:`);
    console.log(`  connection: ${connName} (${row?.connection_id})`);
    console.log(`  route: ${isLiveKitFqdn ? "LiveKit FQDN" : isTexml ? "TeXML Assistant (NOT LiveKit)" : "other"}`);
    if (isTexml) {
      report.ok = false;
      console.log("  ⚠ still on TeXML — production may not have LiveKit publish code deployed yet");
    }
  }

  // 8) DB telephony provision record
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const pn = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
    const settings = pn?.settingsJson && typeof pn.settingsJson === "object" ? pn.settingsJson : {};
    const telephony = settings.telephony || settings.provisioning;
    report.steps.push({
      step: "db_telephony_record",
      ok: Boolean(telephony),
      telephony,
    });
    console.log("\nDB telephony record:", telephony ? JSON.stringify(telephony, null, 2) : "(none)");
    await prisma.$disconnect();
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
