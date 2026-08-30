/**
 * Stable active.mp3 voicemail — atomic swap at Save, static file at call time.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voicemail-active-greeting.ts
 */
import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  greetingTokenForE164,
  provisionActiveVoicemailGreeting,
  readActiveVoicemailGreetingBytes,
  resolveStableVoicemailGreetingPlayUrl,
} from "../src/lib/phone/voicemail-active-greeting";
import { voicemailGreetingsDiskRoot } from "../src/lib/phone/voicemail-greeting-storage";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const E164 = "+15555550199";
const TOKEN = greetingTokenForE164(E164);
const WS = "ws_test_active_greeting";
const CLEANUP_DIR = path.join(voicemailGreetingsDiskRoot(), TOKEN);

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`✓ ${name}`),
    (err) => {
      console.error(`✗ ${name}`);
      throw err;
    },
  );
}

async function main() {
  try {
    await test("stable play URL is opaque and ends in active.mp3", () => {
      const url = resolveStableVoicemailGreetingPlayUrl(TOKEN);
      assert.match(url, /g_[a-f0-9]+\/active\.mp3$/);
    });

    await test("provision default writes active.mp3 on disk", async () => {
      const { playUrl, kind } = await provisionActiveVoicemailGreeting({
        greetingToken: TOKEN,
        workspaceId: WS,
        greetingUrl: null,
      });
      assert.equal(kind, "platform");
      assert.equal(playUrl, resolveStableVoicemailGreetingPlayUrl(TOKEN));

      const activePath = path.join(CLEANUP_DIR, "active.mp3");
      await access(activePath);
      const served = await readActiveVoicemailGreetingBytes(TOKEN);
      assert.ok(served.bytes.length > 1000);
    });

    await test("provision custom atomically replaces active.mp3", async () => {
      const before = await readFile(path.join(CLEANUP_DIR, "active.mp3"));
      const customUrl = `https://cdn.example.com/custom-${Date.now()}.mp3`;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === customUrl) {
          return new Response(before, {
            status: 200,
            headers: { "content-type": "audio/mpeg" },
          });
        }
        return originalFetch(input);
      };

      try {
        const { kind } = await provisionActiveVoicemailGreeting({
          greetingToken: TOKEN,
          workspaceId: WS,
          greetingUrl: customUrl,
        });
        assert.equal(kind, "custom");

        const after = await readFile(path.join(CLEANUP_DIR, "active.mp3"));
        assert.equal(after.length, before.length);

        await access(path.join(CLEANUP_DIR, "previous.mp3"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("re-provision default replaces active.mp3 again", async () => {
      const { kind } = await provisionActiveVoicemailGreeting({
        greetingToken: TOKEN,
        workspaceId: WS,
        greetingUrl: null,
      });
      assert.equal(kind, "platform");
      await access(path.join(CLEANUP_DIR, "active.mp3"));
    });

    console.log("\nAll voicemail active.mp3 tests passed.");
  } finally {
    await rm(CLEANUP_DIR, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
