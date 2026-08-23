import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMapsLiveRequest,
  formatMapsLocationCoordinate,
} from "@/lib/providers/dataforseo/build-maps-request";

describe("DataForSEO Maps location_coordinate", () => {
  it("formats zoom with z suffix per DataForSEO docs", () => {
    assert.equal(
      formatMapsLocationCoordinate(38.7354825480337, -77.4445995074144, 14),
      "38.7354825,-77.4445995,14z"
    );
  });

  it("buildMapsLiveRequest uses Falcon-parity recipe defaults", () => {
    const req = buildMapsLiveRequest({
      keyword: "junk removal near me",
      lat: 38.6631508,
      lng: -77.3518246,
      profile: { device: "desktop", os: "windows", browser: "chrome" },
      depth: 20,
    });
    assert.equal(req.location_coordinate, "38.6631508,-77.3518246,14z");
    assert.equal(req._meta.zoom, 14);
    assert.equal(req.device, "desktop");
    assert.equal(req.os, "windows");
    assert.equal(req.search_this_area, false);
    assert.equal(req.search_places, true);
    assert.equal(req.se_domain, "google.com");
    assert.equal(req.depth, 20);
    assert.equal(req._meta.endpoint, "serp/google/maps/live/advanced");
    const body = { ...req };
    delete (body as { _meta?: unknown })._meta;
    assert.equal("browser" in body, false);
  });
});
