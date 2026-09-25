/**
 * Static check: Voice Analytics route must not redirect to MCTB.
 * Run: npx tsx scripts/test-voice-analytics-routing.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const configPath = path.join(process.cwd(), "next.config.ts");
  const text = await readFile(configPath, "utf8");
  assert.ok(
    !text.includes('source: "/voice/analytics", destination: "/mctb/analytics"'),
    "next.config must not redirect /voice/analytics to MCTB",
  );
  console.log("test-voice-analytics-routing: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
