#!/usr/bin/env node
/**
 * Compare LiveKit Cloud vs self-hosted SIP objects (no secrets in output).
 */
import { SipClient } from "livekit-server-sdk";
import { execSync } from "node:child_process";

function normalizeApiUrl(raw) {
  let value = raw.trim();
  if (!value.includes("://")) value = `wss://${value}`;
  try {
    const u = new URL(value);
    if (u.hostname.includes(".sip.livekit.cloud")) {
      u.hostname = u.hostname.replace(".sip.livekit.cloud", ".livekit.cloud");
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

async function snapshot(client, label, url) {
  const inbound = await client.listSipInboundTrunk();
  const outbound = await client.listSipOutboundTrunk();
  const rules = await client.listSipDispatchRule();
  return {
    backend: label,
    url,
    inbound: inbound.map((t) => ({
      id: t.sipTrunkId,
      name: t.name,
      numberCount: t.numbers?.length ?? 0,
      sampleNumbers: (t.numbers || []).slice(0, 3),
      allowedCount: (t.allowedAddresses || []).length,
    })),
    outbound: outbound.map((t) => ({
      id: t.sipTrunkId,
      name: t.name,
      address: t.address,
      sampleNumbers: (t.numbers || []).slice(0, 3),
    })),
    dispatchRules: rules.map((r) => ({
      id: r.sipDispatchRuleId,
      name: r.name,
      trunkIds: r.trunkIds,
      agent: r.roomConfig?.agents?.[0]?.agentName,
    })),
  };
}

function loadSelfHostedCreds() {
  const key = process.env.LIVEKIT_SELF_HOSTED_API_KEY?.trim();
  const secret = process.env.LIVEKIT_SELF_HOSTED_API_SECRET?.trim();
  if (key && secret) return { key, secret };
  const host = process.env.LIVEKIT_SERVER_HOST?.trim();
  const user = process.env.LIVEKIT_SERVER_USER?.trim() || "root";
  if (!host || !process.env.LIVEKIT_SERVER_SSH_KEY) return null;
  try {
    const envText = execSync(
      `ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/transovo_livekit ${user}@${host} 'cat /opt/transovo-livekit/.env'`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const get = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
    return { key: get("LIVEKIT_API_KEY"), secret: get("LIVEKIT_API_SECRET") };
  } catch {
    return null;
  }
}

async function main() {
  const cloudUrl = normalizeApiUrl(process.env.LIVEKIT_URL || "");
  const cloud = new SipClient(
    cloudUrl,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  );
  const report = {
    at: new Date().toISOString(),
    cloud: await snapshot(cloud, "livekit_cloud", cloudUrl),
  };

  const selfCreds = loadSelfHostedCreds();
  const selfUrl =
    process.env.LIVEKIT_SELF_HOSTED_URL?.trim() || "wss://voice.transovo.ai";
  if (selfCreds?.key && selfCreds?.secret) {
    const self = new SipClient(selfUrl, selfCreds.key, selfCreds.secret);
    report.selfHosted = await snapshot(self, "self_hosted", selfUrl);
  } else {
    report.selfHosted = { error: "self_hosted_credentials_unavailable" };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
