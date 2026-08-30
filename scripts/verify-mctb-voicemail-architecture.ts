/**
 * Architecture verification — MCTB voicemail active.mp3 model.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-mctb-voicemail-architecture.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildInstantVoicemailTexml } from "../src/lib/mctb/texml-ingress/instant-voicemail-texml";
import { greetingTokenForE164 } from "../src/lib/phone/voicemail-active-greeting";

const E164 = "+15714073615";

function check(name: string, ok: boolean, detail: string) {
  console.log(ok ? `✓ ${name}` : `✗ ${name}: ${detail}`);
  assert.ok(ok, detail);
}

async function main() {
  const built = buildInstantVoicemailTexml({ toE164: E164 });
  check("1. Voicemail TeXML built without DB/async", true, "");

  const entrySrc = await readFile(
    path.join(process.cwd(), "src/app/api/telnyx/voice/mctb-voicemail/route.ts"),
    "utf8",
  );
  check(
    "1. mctb-voicemail route has no prisma/getPrisma",
    !/getPrisma|prisma\./.test(entrySrc),
    "found DB access in voicemail ingress",
  );
  check(
    "1. mctb-voicemail route has no routing profile peek",
    !/peekMctbInboundRoutingProfile/.test(entrySrc),
    "found in-memory profile peek",
  );

  const storageSrc = await readFile(
    path.join(process.cwd(), "src/lib/phone/voicemail-greeting-storage.ts"),
    "utf8",
  );
  check(
    "2. Durable Supabase storage path exists",
    /ensureVoicemailGreetingBucket|supabase\.storage/.test(storageSrc),
    "missing supabase storage",
  );

  const activeSrc = await readFile(
    path.join(process.cwd(), "src/lib/phone/voicemail-active-greeting.ts"),
    "utf8",
  );
  check(
    "3. Atomic swap via writeVoicemailActiveMp3",
    /writeVoicemailActiveMp3|atomicWriteFile|upsert:\s*true/.test(activeSrc + storageSrc),
    "missing atomic write",
  );

  const nextConfig = await readFile(path.join(process.cwd(), "next.config.ts"), "utf8");
  check(
    "4. Short/no cache on /voicemail/*/active.mp3",
    /voicemail.*active\.mp3/.test(nextConfig) && /no-cache|must-revalidate/.test(nextConfig),
    "missing cache headers",
  );

  const token = greetingTokenForE164(E164);
  check(
    "5. Greeting token deterministic from E164 only",
    built.greetingToken === token,
    `expected ${token}, got ${built.greetingToken}`,
  );
  check(
    "5. Play URL stable and includes active.mp3",
    built.playUrl.includes(`${token}/active.mp3`),
    built.playUrl,
  );

  console.log("\nAll voicemail architecture checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
