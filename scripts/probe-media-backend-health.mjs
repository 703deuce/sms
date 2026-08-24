#!/usr/bin/env node
import { execSync } from "node:child_process";
import {
  getMediaBackendHealthReport,
  probeMediaBackendHealth,
  resolveMediaBackend,
} from "../src/lib/voice/media-backend/index.js";

function maybeLoadSelfHostedFromServer() {
  if (process.env.LIVEKIT_SELF_HOSTED_API_KEY && process.env.LIVEKIT_SELF_HOSTED_API_SECRET) {
    return;
  }
  const host = process.env.LIVEKIT_SERVER_HOST?.trim();
  const user = process.env.LIVEKIT_SERVER_USER?.trim() || "root";
  if (!host || !process.env.LIVEKIT_SERVER_SSH_KEY) return;
  try {
    const envText = execSync(
      `ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/transovo_livekit ${user}@${host} 'cat /opt/transovo-livekit/.env'`,
      { encoding: "utf8" },
    );
    const get = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
    process.env.LIVEKIT_SELF_HOSTED_API_KEY ||= get("LIVEKIT_API_KEY");
    process.env.LIVEKIT_SELF_HOSTED_API_SECRET ||= get("LIVEKIT_API_SECRET");
    process.env.LIVEKIT_SELF_HOSTED_URL ||= "wss://voice.transovo.ai";
  } catch {
    // ignore
  }
}

async function main() {
  maybeLoadSelfHostedFromServer();
  const report = await getMediaBackendHealthReport();
  const testDid = process.env.LIVEKIT_SELF_HOSTED_TEST_DID || "+18663221763";
  const resolvedForTestDid = await resolveMediaBackend({ toE164: testDid });
  console.log(
    JSON.stringify(
      {
        ...report,
        resolvedForTestDid,
        selfHostedProbe: await probeMediaBackendHealth("self_hosted").catch((e) => ({
          error: String(e),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
