import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMapsGridRequest } from "@/lib/providers/scrapingdog/maps-grid";

describe("ScrapingDog Maps request shape", () => {
  it("uses google_maps query + ll=@lat,lng,zoomz (not DataForSEO location_coordinate)", () => {
    const req = buildMapsGridRequest({
      keyword: "junk removal woodbridge",
      lat: 38.7354825480337,
      lng: -77.4445995074144,
      device: "mobile",
      os: "android",
      browser: "chrome",
      depth: 20,
      zoom: 14,
    });
    assert.equal(req.endpoint, "https://api.scrapingdog.com/google_maps");
    assert.equal(req.query, "junk removal woodbridge");
    assert.equal(req.ll, "@38.7354825,-77.4445995,14z");
    assert.equal(req._meta.location_zoom, 14);
    assert.equal(req.domain, "google.com");
    assert.equal(req.language, "en");
    assert.equal(req.country, "us");
    assert.equal(req.search_engine, "google_maps");
  });

  it("defaults zoom to Falcon-match 14 when omitted", () => {
    const req = buildMapsGridRequest({
      keyword: "plumber",
      lat: 27.9506,
      lng: -82.4572,
      device: "mobile",
      os: "android",
      browser: "chrome",
    });
    assert.equal(req.ll, "@27.9506,-82.4572,14z");
    assert.equal(req._meta.location_zoom, 14);
  });
});
