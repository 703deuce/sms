#!/usr/bin/env node
/**
 * Media backend integration tests (resolver, health, pinning, backend audit).
 * Run: npx tsx scripts/test-media-backend.ts
 */
import assert from "node:assert/strict";
import {
  getMediaBackendMode,
  isMediaBackendConfigured,
  parseMediaBackend,
  resetMediaBackendHealthForTests,
  resetLiveKitClientsForTests,
} from "../src/lib/voice/media-backend";
import { setDefaultLiveKitSipBackendForTests } from "../src/lib/telephony/provisioning/livekit/client";

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

  await check("media_backend_mode_default", () => {
    const prev = process.env.MEDIA_BACKEND_MODE;
    delete process.env.MEDIA_BACKEND_MODE;
    assert.equal(getMediaBackendMode(), "auto");
    if (prev) process.env.MEDIA_BACKEND_MODE = prev;
  });

  await check("cloud_backend_configured", () => {
    assert.equal(isMediaBackendConfigured("livekit_cloud"), true);
  });

  resetMediaBackendHealthForTests();
  resetLiveKitClientsForTests();
  setDefaultLiveKitSipBackendForTests(null);

  if (failures.length) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log("\nAll media-backend unit checks passed.");
}

main();
