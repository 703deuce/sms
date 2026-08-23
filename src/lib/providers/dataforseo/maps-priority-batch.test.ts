import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DATAFORSEO_MAPS_PRIORITY_HIGH,
  MAPS_TASK_POST_ENDPOINT,
  sanitizeMapsTaskTag,
  normalizeMapsSerpItems,
} from "@/lib/providers/dataforseo/maps-priority-batch";
import { buildMapsLiveRequest, mapsLiveRequestBody } from "@/lib/providers/dataforseo/build-maps-request";
import type { MapsLiveResult } from "@/lib/providers/dataforseo/index";

describe("DataForSEO Maps Priority batch shape", () => {
  it("uses high priority, STA off, search_places on, zoom 14 (Falcon recipe)", () => {
    assert.equal(DATAFORSEO_MAPS_PRIORITY_HIGH, 2);
    assert.equal(MAPS_TASK_POST_ENDPOINT, "serp/google/maps/task_post");

    const request = buildMapsLiveRequest({
      keyword: "junk removal near me",
      lat: 38.6631508,
      lng: -77.3518246,
      profile: { device: "desktop", os: "windows", browser: "chrome" },
      depth: 20,
    });
    const body = {
      ...mapsLiveRequestBody(request),
      priority: DATAFORSEO_MAPS_PRIORITY_HIGH,
      tag: sanitizeMapsTaskTag("point:keyword"),
    };

    assert.equal(body.priority, 2);
    assert.equal(body.search_this_area, false);
    assert.equal(body.search_places, true);
    assert.equal(body.depth, 20);
    assert.equal(body.device, "desktop");
    assert.equal(body.os, "windows");
    assert.match(body.location_coordinate, /14z$/);
    assert.equal(body.tag, "point_keyword");
  });

  it("supports standard (priority=1) task_post bodies", async () => {
    const { DATAFORSEO_MAPS_PRIORITY_STANDARD } = await import(
      "@/lib/providers/dataforseo/maps-priority-batch"
    );
    assert.equal(DATAFORSEO_MAPS_PRIORITY_STANDARD, 1);
  });

  it("sanitizes tags and keeps maps_search items", () => {
    assert.equal(sanitizeMapsTaskTag("a:b:c"), "a_b_c");
    const items = [
      { type: "refinement_chips", title: "x" },
      { type: "maps_search", title: "Acme", rank_absolute: 1 },
      { type: "maps_search", title: "Other", rank_absolute: 2 },
    ] as MapsLiveResult[];
    assert.equal(normalizeMapsSerpItems(items).length, 2);
  });
});
