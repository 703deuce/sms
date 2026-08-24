#!/usr/bin/env node
/**
 * Media backend selector tests.
 * Run: npx tsx scripts/test-media-backend.ts
 */
import assert from "node:assert/strict";
import {
  getActiveMediaBackend,
  getMediaBackendMode,
  isMediaBackendConfigured,
  parseMediaBackend,
  resetLiveKitClientsForTests,
} from "../src/lib/voice/media-backend";

async function main() {
  const failures: string[] = [];

  function check(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => console.log(`PASS ${name}`))
      .catch((e) => {
        failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        console.error(`FAIL ${name}`, e);
      });
  }

  await check("parseMediaBackend", () => {
    assert.equal(parseMediaBackend("self_hosted"), "self_hosted");
    assert.equal(parseMediaBackend("livekit_cloud"), "livekit_cloud");
    assert.equal(parseMediaBackend("invalid"), null);
  });

  await check("media_backend_mode_default_cloud", () => {
    const prev = process.env.MEDIA_BACKEND_MODE;
    delete process.env.MEDIA_BACKEND_MODE;
    assert.equal(getMediaBackendMode(), "livekit_cloud");
    assert.equal(getActiveMediaBackend(), "livekit_cloud");
    if (prev) process.env.MEDIA_BACKEND_MODE = prev;
  });

  await check("media_backend_mode_self_hosted", () => {
    const prev = process.env.MEDIA_BACKEND_MODE;
    process.env.MEDIA_BACKEND_MODE = "self_hosted";
    assert.equal(getMediaBackendMode(), "self_hosted");
    assert.equal(getActiveMediaBackend(), "self_hosted");
    if (prev) process.env.MEDIA_BACKEND_MODE = prev;
    else delete process.env.MEDIA_BACKEND_MODE;
  });

  await check("cloud_backend_configured", () => {
    assert.equal(isMediaBackendConfigured("livekit_cloud"), true);
  });

  await check("authoritative_sip_host_follows_self_hosted_mode", () => {
    const prevMode = process.env.MEDIA_BACKEND_MODE;
    const prevCloudUri = process.env.LIVEKIT_SIP_URI;
    const prevSelfUrl = process.env.LIVEKIT_SELF_HOSTED_URL;
    const prevSelfHost = process.env.LIVEKIT_SELF_HOSTED_SIP_HOST;

    process.env.MEDIA_BACKEND_MODE = "self_hosted";
    process.env.LIVEKIT_SIP_URI = "cloud-only.sip.livekit.cloud";
    process.env.LIVEKIT_SELF_HOSTED_URL = "wss://voice.example.com";
    process.env.LIVEKIT_SELF_HOSTED_API_KEY = "test-key";
    process.env.LIVEKIT_SELF_HOSTED_API_SECRET = "test-secret";
    process.env.LIVEKIT_SELF_HOSTED_SIP_HOST = "voice.example.com";

    const { resolveAuthoritativeLiveKitSipHost } = require("../src/lib/voice/media-backend/sip-host") as typeof import("../src/lib/voice/media-backend/sip-host");
    const sip = resolveAuthoritativeLiveKitSipHost();
    assert.equal(sip.host, "voice.example.com");
    assert.equal(sip.source, "LIVEKIT_SELF_HOSTED_SIP_HOST");

    if (prevMode) process.env.MEDIA_BACKEND_MODE = prevMode;
    else delete process.env.MEDIA_BACKEND_MODE;
    if (prevCloudUri) process.env.LIVEKIT_SIP_URI = prevCloudUri;
    else delete process.env.LIVEKIT_SIP_URI;
    if (prevSelfUrl) process.env.LIVEKIT_SELF_HOSTED_URL = prevSelfUrl;
    else delete process.env.LIVEKIT_SELF_HOSTED_URL;
    delete process.env.LIVEKIT_SELF_HOSTED_API_KEY;
    delete process.env.LIVEKIT_SELF_HOSTED_API_SECRET;
    if (prevSelfHost) process.env.LIVEKIT_SELF_HOSTED_SIP_HOST = prevSelfHost;
    else delete process.env.LIVEKIT_SELF_HOSTED_SIP_HOST;
  });

  resetLiveKitClientsForTests();

  if (failures.length) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log("\nAll media-backend unit checks passed.");
}

main();
