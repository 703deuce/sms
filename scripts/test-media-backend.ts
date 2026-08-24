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

  resetLiveKitClientsForTests();

  if (failures.length) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log("\nAll media-backend unit checks passed.");
}

main();
