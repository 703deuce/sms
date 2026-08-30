/**
 * Stable active voicemail greeting — provision at config time, serve without DB.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voicemail-active-greeting.ts
 */
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  provisionActiveVoicemailGreeting,
  readActiveVoicemailGreetingBytes,
  resolveStableVoicemailGreetingPlayUrl,
} from "../src/lib/phone/voicemail-active-greeting";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const WS = "ws_test_active_greeting";
const PHONE = "phone_test_active_greeting";
const CLEANUP_DIR = path.join(process.cwd(), "public", "voicemail-greetings", WS);

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
    await test("stable play URL is deterministic", () => {
      const url = resolveStableVoicemailGreetingPlayUrl(WS, PHONE);
      assert.match(
        url,
        /\/api\/public\/greetings\/ws_test_active_greeting\/phone_test_active_greeting\/active$/,
      );
    });

    await test("provision default sets platform pointer and serves bytes", async () => {
      const { playUrl, kind } = await provisionActiveVoicemailGreeting({
        workspaceId: WS,
        phoneNumberId: PHONE,
        greetingUrl: null,
      });
      assert.equal(kind, "platform");
      assert.equal(playUrl, resolveStableVoicemailGreetingPlayUrl(WS, PHONE));

      const served = await readActiveVoicemailGreetingBytes(WS, PHONE);
      assert.ok(served.bytes.length > 1000, "platform greeting should have audio bytes");
      assert.equal(served.source, "platform");
    });

    await test("provision custom writes versioned file; active serves custom", async () => {
      const platform = await readActiveVoicemailGreetingBytes(WS, PHONE);
      const customUrl = `https://cdn.example.com/custom-${Date.now()}.mp3`;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === customUrl) {
          return new Response(platform.bytes, {
            status: 200,
            headers: { "content-type": "audio/mpeg" },
          });
        }
        return originalFetch(input);
      };

      try {
        const { kind } = await provisionActiveVoicemailGreeting({
          workspaceId: WS,
          phoneNumberId: PHONE,
          greetingUrl: customUrl,
        });
        assert.equal(kind, "custom");

        const served = await readActiveVoicemailGreetingBytes(WS, PHONE);
        assert.equal(served.source, "custom");
        assert.equal(served.bytes.length, platform.bytes.length);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("re-provision back to default fails open to platform", async () => {
      const { kind } = await provisionActiveVoicemailGreeting({
        workspaceId: WS,
        phoneNumberId: PHONE,
        greetingUrl: null,
      });
      assert.equal(kind, "platform");
      const served = await readActiveVoicemailGreetingBytes(WS, PHONE);
      assert.equal(served.source, "platform");
    });

    console.log("\nAll voicemail active greeting tests passed.");
  } finally {
    await rm(CLEANUP_DIR, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
