#!/usr/bin/env node
/**
 * Switch primary LIVEKIT_* env from Cloud → self-hosted production.
 * Preserves existing Cloud values as LIVEKIT_CLOUD_* fallback (does not delete).
 *
 * Usage:
 *   node scripts/switch-livekit-primary-to-self-hosted.mjs print   # Coolify env block (no secrets)
 *   node scripts/switch-livekit-primary-to-self-hosted.mjs verify  # test self-hosted API auth
 */
import { RoomServiceClient } from "livekit-server-sdk";

function redact(v) {
  if (!v) return "(unset)";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function trimEnv(v) {
  return (v || "").trim().replace(/^["']|["']$/g, "");
}

function normalizeApiUrl(raw) {
  let value = (raw || "").trim();
  if (!value) return "";
  if (!value.includes("://")) value = `wss://${value}`;
  return value.replace(/\/$/, "");
}

function buildEnvMapping() {
  const current = {
    url: trimEnv(process.env.LIVEKIT_URL),
    apiKey: trimEnv(process.env.LIVEKIT_API_KEY),
    apiSecret: trimEnv(process.env.LIVEKIT_API_SECRET),
    sipUri: trimEnv(process.env.LIVEKIT_SIP_URI),
    sipHost: trimEnv(process.env.LIVEKIT_SIP_HOST),
    inboundTrunkId: trimEnv(process.env.LIVEKIT_INBOUND_TRUNK_ID),
    outboundTrunkId:
      trimEnv(process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID) ||
      trimEnv(process.env.LIVEKIT_OUTBOUND_TRUNK_ID),
    dispatchRuleId: trimEnv(process.env.LIVEKIT_DISPATCH_RULE_ID),
    telnyxFqdnConnectionId: trimEnv(process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID),
  };

  const selfHosted = {
    url: trimEnv(process.env.LIVEKIT_SELF_HOSTED_URL), // pragma: allowlist secret
    apiKey: trimEnv(process.env.LIVEKIT_SELF_HOSTED_API_KEY),
    apiSecret: trimEnv(process.env.LIVEKIT_SELF_HOSTED_API_SECRET),
    sipHost: trimEnv(process.env.LIVEKIT_SELF_HOSTED_SIP_HOST),
    inboundTrunkId: trimEnv(process.env.LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID),
    outboundTrunkId: trimEnv(process.env.LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID),
    dispatchRuleId: trimEnv(process.env.LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID),
  };

  const cloudFallback = {
    url: trimEnv(process.env.LIVEKIT_CLOUD_URL) || current.url,
    apiKey: trimEnv(process.env.LIVEKIT_CLOUD_API_KEY) || current.apiKey,
    apiSecret: trimEnv(process.env.LIVEKIT_CLOUD_API_SECRET) || current.apiSecret,
    sipUri:
      trimEnv(process.env.LIVEKIT_CLOUD_SIP_URI) ||
      current.sipUri ||
      current.sipHost ||
      "",
    inboundTrunkId:
      trimEnv(process.env.LIVEKIT_CLOUD_INBOUND_TRUNK_ID) || current.inboundTrunkId,
    outboundTrunkId:
      trimEnv(process.env.LIVEKIT_CLOUD_OUTBOUND_TRUNK_ID) || current.outboundTrunkId,
    dispatchRuleId:
      trimEnv(process.env.LIVEKIT_CLOUD_DISPATCH_RULE_ID) || current.dispatchRuleId,
    telnyxFqdnConnectionId:
      trimEnv(process.env.LIVEKIT_CLOUD_TELNYX_FQDN_CONNECTION_ID) ||
      current.telnyxFqdnConnectionId,
  };

  const primary = {
    LIVEKIT_URL: normalizeApiUrl(selfHosted.url),
    LIVEKIT_API_KEY: selfHosted.apiKey,
    LIVEKIT_API_SECRET: selfHosted.apiSecret,
    LIVEKIT_SIP_URI: selfHosted.sipHost || selfHosted.url.replace(/^wss?:\/\//, "").split("/")[0],
    LIVEKIT_SIP_HOST: selfHosted.sipHost || selfHosted.url.replace(/^wss?:\/\//, "").split("/")[0],
    LIVEKIT_INBOUND_TRUNK_ID: selfHosted.inboundTrunkId,
    LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID: selfHosted.outboundTrunkId,
    LIVEKIT_OUTBOUND_TRUNK_ID: selfHosted.outboundTrunkId,
    LIVEKIT_DISPATCH_RULE_ID: selfHosted.dispatchRuleId,
  };

  const fallback = {
    LIVEKIT_CLOUD_URL: normalizeApiUrl(cloudFallback.url),
    LIVEKIT_CLOUD_API_KEY: cloudFallback.apiKey,
    LIVEKIT_CLOUD_API_SECRET: cloudFallback.apiSecret,
    LIVEKIT_CLOUD_SIP_URI: cloudFallback.sipUri,
    LIVEKIT_CLOUD_INBOUND_TRUNK_ID: cloudFallback.inboundTrunkId,
    LIVEKIT_CLOUD_OUTBOUND_TRUNK_ID: cloudFallback.outboundTrunkId,
    LIVEKIT_CLOUD_DISPATCH_RULE_ID: cloudFallback.dispatchRuleId,
    LIVEKIT_CLOUD_TELNYX_FQDN_CONNECTION_ID: cloudFallback.telnyxFqdnConnectionId,
  };

  return { current, selfHosted, primary, fallback };
}

async function verifySelfHostedConnection(mapping) {
  const { url, apiKey, apiSecret } = {
    url: mapping.primary.LIVEKIT_URL,
    apiKey: mapping.primary.LIVEKIT_API_KEY,
    apiSecret: mapping.primary.LIVEKIT_API_SECRET,
  };

  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "Self-hosted credentials missing. Set LIVEKIT_SELF_HOSTED_API_KEY and LIVEKIT_SELF_HOSTED_API_SECRET.",
    );
  }

  const client = new RoomServiceClient(url, apiKey, apiSecret);
  const rooms = await client.listRooms();
  const tlsRes = await fetch(url.replace(/^wss:/i, "https:"), {
    signal: AbortSignal.timeout(8000),
  }).catch((err) => ({ ok: false, status: 0, error: String(err) }));

  return {
    ok: true,
    url,
    apiKey: redact(apiKey),
    roomCount: rooms.length,
    tls: tlsRes.ok ? `http_status_${tlsRes.status}` : tlsRes.error || "tls_failed",
    sipHost: mapping.primary.LIVEKIT_SIP_HOST,
  };
}

async function main() {
  const cmd = process.argv[2] || "print";
  const mapping = buildEnvMapping();

  if (cmd === "print") {
    console.log(
      JSON.stringify(
        {
          step: "coolify_env_swap",
          instruction:
            "Set primary LIVEKIT_* to self-hosted. Archive current Cloud values under LIVEKIT_CLOUD_*.",
          primary: Object.fromEntries(
            Object.entries(mapping.primary).map(([k, v]) => [k, v ? redact(v) : "(unset)"]),
          ),
          fallback: Object.fromEntries(
            Object.entries(mapping.fallback).map(([k, v]) => [k, v ? redact(v) : "(unset)"]),
          ),
          services: ["transovo-web", "transovo-voice"],
          afterDeploy: [
            "Redeploy/restart transovo-web and transovo-voice",
            "node scripts/switch-livekit-primary-to-self-hosted.mjs verify",
            "Call existing 571-407 number; confirm logs show self-hosted host not livekit.cloud",
          ],
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "verify") {
    const result = await verifySelfHostedConnection(mapping);
    console.log(JSON.stringify({ step: "verify_self_hosted", ...result }, null, 2));
    if (!result.ok) process.exit(1);
    return;
  }

  throw new Error(`Unknown command: ${cmd}. Use print or verify.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
