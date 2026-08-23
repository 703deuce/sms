import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { describeMapsProviderAvailability } from "@/lib/providers/maps-grid/orchestrator";

describe("Maps provider availability", () => {
  const prev = {
    fallback: process.env.MAPS_GRID_FALLBACK_ENABLED,
    dfsEnabled: process.env.DATAFORSEO_MAPS_ENABLED,
    dfsUser: process.env.DATAFORSEO_USERNAME,
    dfsPass: process.env.DATAFORSEO_PASSWORD,
    sdEnabled: process.env.SCRAPINGDOG_MAPS_ENABLED,
    sdKey: process.env.SCRAPINGDOG_API_KEY,
    sdKey2: process.env.SCRAPING_DOG_API_KEY,
  };

  before(() => {
    process.env.MAPS_GRID_FALLBACK_ENABLED = "true";
    process.env.DATAFORSEO_MAPS_ENABLED = "true";
    process.env.SCRAPINGDOG_MAPS_ENABLED = "true";
    delete process.env.DATAFORSEO_USERNAME;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.SCRAPINGDOG_API_KEY;
    delete process.env.SCRAPING_DOG_API_KEY;
  });

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      const envKey =
        k === "fallback"
          ? "MAPS_GRID_FALLBACK_ENABLED"
          : k === "dfsEnabled"
            ? "DATAFORSEO_MAPS_ENABLED"
            : k === "dfsUser"
              ? "DATAFORSEO_USERNAME"
              : k === "dfsPass"
                ? "DATAFORSEO_PASSWORD"
                : k === "sdEnabled"
                  ? "SCRAPINGDOG_MAPS_ENABLED"
                  : k === "sdKey"
                    ? "SCRAPINGDOG_API_KEY"
                    : "SCRAPING_DOG_API_KEY";
      if (v == null) delete process.env[envKey];
      else process.env[envKey] = v;
    }
  });

  it("flags missing DataForSEO credentials instead of silently enabling", () => {
    const a = describeMapsProviderAvailability("dataforseo");
    assert.equal(a.enabled, false);
    assert.equal(a.skipReason, "missing_credentials");
  });

  it("flags missing ScrapingDog credentials", () => {
    const a = describeMapsProviderAvailability("scrapingdog");
    assert.equal(a.enabled, false);
    assert.equal(a.skipReason, "missing_credentials");
  });

  it("enables DataForSEO when credentials are present", () => {
    process.env.DATAFORSEO_USERNAME = "user";
    process.env.DATAFORSEO_PASSWORD = "pass";
    const a = describeMapsProviderAvailability("dataforseo");
    assert.equal(a.enabled, true);
  });
});
