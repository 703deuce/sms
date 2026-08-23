import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectBotOrPreview, categorizeUserAgent } from "./bot-filter";
import {
  assertAllowedQrDestination,
  generateClaimToken,
  generateShortCode,
  hashClaimToken,
  hashIpForQrScan,
  isAllowedQrDestination,
} from "./security";
import { QR_PLACEMENT_TYPES } from "./types";

describe("qr campaign security", () => {
  it("accepts Google review destinations only", () => {
    assert.equal(
      isAllowedQrDestination(
        "https://search.google.com/local/writereview?placeid=ChIJtest"
      ),
      true
    );
    assert.equal(isAllowedQrDestination("https://evil.example/phish"), false);
    assert.equal(isAllowedQrDestination("http://search.google.com/local/writereview?placeid=x"), false);
    assert.throws(() => assertAllowedQrDestination("https://example.com"));
  });

  it("generates unique-looking short codes and claim tokens", () => {
    const a = generateShortCode();
    const b = generateShortCode();
    assert.notEqual(a, b);
    assert.ok(a.length >= 8);
    const t = generateClaimToken();
    assert.ok(t.length >= 32);
    assert.equal(hashClaimToken(t).length, 64);
  });

  it("hashes IPs with HMAC (not raw)", () => {
    const h = hashIpForQrScan("203.0.113.10");
    assert.equal(h.includes("203.0.113.10"), false);
    assert.equal(h.length, 64);
    assert.equal(hashIpForQrScan("203.0.113.10"), h);
  });
});

describe("qr bot filter", () => {
  it("flags crawlers and previews", () => {
    assert.equal(detectBotOrPreview("Googlebot/2.1").isBot, true);
    assert.equal(detectBotOrPreview("facebookexternalhit/1.1").isPreview, true);
    assert.equal(detectBotOrPreview("Mozilla/5.0 (iPhone) Safari/604.1").isBot, false);
  });

  it("categorizes devices", () => {
    const mobile = categorizeUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    );
    assert.equal(mobile.deviceCategory, "mobile");
    const desktop = categorizeUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
    );
    assert.equal(desktop.deviceCategory, "desktop");
    assert.equal(desktop.browserCategory, "chrome");
  });
});

describe("qr placements", () => {
  it("includes core print placements", () => {
    assert.ok(QR_PLACEMENT_TYPES.includes("front_desk"));
    assert.ok(QR_PLACEMENT_TYPES.includes("receipt_insert"));
    assert.ok(QR_PLACEMENT_TYPES.includes("company_vehicle"));
  });
});
