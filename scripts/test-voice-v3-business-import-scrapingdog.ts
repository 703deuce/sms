/**
 * Smoke test ScrapingDog Maps search (requires SCRAPINGDOG_API_KEY).
 * Run: npx tsx scripts/test-voice-v3-business-import-scrapingdog.ts
 */
import {
  getScrapingDogApiKey,
  scrapingDogEnvKeyName,
  searchGoogleMapsBusinesses,
} from "../src/lib/scrapingdog/client";

const key = getScrapingDogApiKey();
if (!key) {
  console.error("SKIP: no ScrapingDog API key in env");
  process.exit(0);
}

async function main() {
  console.log(`Using env key: ${scrapingDogEnvKeyName()}`);
  const results = await searchGoogleMapsBusinesses("plumber Woodbridge VA", { country: "us" });
  if (!results.length) {
    console.error("FAIL: zero search results");
    process.exit(1);
  }
  const first = results[0];
  if (!first.title) {
    console.error("FAIL: first result missing title", first);
    process.exit(1);
  }
  console.log(`PASS: ${results.length} results; first="${first.title}"`);
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
