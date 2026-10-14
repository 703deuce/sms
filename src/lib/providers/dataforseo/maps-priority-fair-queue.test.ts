import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkPreparedMapsRows,
  mapsPriorityTakeSize,
  mapsSubmitPriorityFromJob,
  packFairMapsPostPayload,
  MapsPriorityFairQueue,
  type PreparedMapsPriorityRow,
} from "@/lib/providers/dataforseo/maps-priority-fair-queue";

function fakeRows(n: number, prefix: string): PreparedMapsPriorityRow[] {
  return Array.from({ length: n }, (_, i) => ({
    tag: `${prefix}-${i}`,
    body: { tag: `${prefix}-${i}` },
    request: {
      keyword: "junk removal near me",
      location_coordinate: "38.66,-77.35,14z",
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 20,
      search_this_area: false,
      search_places: true,
      se_domain: "google.com",
      priority: 2,
      _meta: {
        endpoint: "serp/google/maps/live/advanced",
        search_engine: "google_maps",
        lat: 38.66,
        lng: -77.35,
        zoom: 14,
        personalization: "none",
        browser: "chrome",
        country_code: "US",
      },
    },
  }));
}

describe("DataForSEO adaptive Priority queue", () => {
  it("maps job priorities to submit tiers", () => {
    assert.equal(mapsSubmitPriorityFromJob("highest"), 1);
    assert.equal(mapsSubmitPriorityFromJob("normal"), 2);
    assert.equal(mapsSubmitPriorityFromJob("scheduled"), 3);
    assert.equal(mapsSubmitPriorityFromJob("retry"), 4);
    assert.equal(mapsSubmitPriorityFromJob(undefined), 2);
  });

  it("solo take size is full POST; contended is fair chunk", () => {
    assert.equal(mapsPriorityTakeSize(false), 100);
    assert.equal(mapsPriorityTakeSize(true), 25);
  });

  it("chunks helper still slices to 25 when asked", () => {
    const rows = fakeRows(225, "c");
    const chunks = chunkPreparedMapsRows(rows, 25);
    assert.equal(chunks.length, 9);
    assert.equal(chunks[0]!.length, 25);
  });

  it("solo scan fills POST to 100 (no artificial 25-split)", () => {
    const pending = [
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(225, "a") },
    ];
    const { selected, contended, takeSize } = packFairMapsPostPayload(pending, {
      maxTasksPerPost: 100,
    });
    assert.equal(contended, false);
    assert.equal(takeSize, 100);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]!.rows.length, 100);
    assert.equal(selected[0]!.scanKey, "A");
  });

  it("contended scans round-robin 25-cell slices into one 100-task POST", () => {
    const pending = [
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(75, "a") },
      { scanKey: "B", priority: 1 as const, organizationId: "org1", rows: fakeRows(75, "b") },
      { scanKey: "C", priority: 1 as const, organizationId: "org1", rows: fakeRows(50, "c") },
      { scanKey: "D", priority: 1 as const, organizationId: "org1", rows: fakeRows(50, "d") },
    ];
    const { selected, contended } = packFairMapsPostPayload(pending, {
      maxTasksPerPost: 100,
      fairChunkSize: 25,
    });
    assert.equal(contended, true);
    assert.equal(selected.reduce((n, c) => n + c.rows.length, 0), 100);
    assert.equal(selected.length, 4);
    assert.deepEqual(
      selected.map((c) => c.scanKey).sort(),
      ["A", "B", "C", "D"]
    );
    for (const slice of selected) {
      assert.equal(slice.rows.length, 25);
    }
  });

  it("does not mix organizations in one POST", () => {
    const pending = [
      { scanKey: "A", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a") },
      { scanKey: "B", priority: 1 as const, organizationId: "org2", rows: fakeRows(25, "b") },
    ];
    const { selected } = packFairMapsPostPayload(pending, { maxTasksPerPost: 100 });
    assert.equal(selected.length, 1);
    assert.equal(selected[0]!.organizationId, "org1");
    // Solo within org → full fill (25 available)
    assert.equal(selected[0]!.rows.length, 25);
  });

  it("serves higher app priority before lower", () => {
    const pending = [
      { scanKey: "retry", priority: 4 as const, organizationId: "org1", rows: fakeRows(25, "r") },
      { scanKey: "active", priority: 1 as const, organizationId: "org1", rows: fakeRows(25, "a") },
    ];
    const { selected } = packFairMapsPostPayload(pending, { maxTasksPerPost: 100 });
    assert.equal(selected[0]!.scanKey, "active");
  });

  it("solo submit posts full 100 then remainder without 25-slicing", async () => {
    const postSizes: number[] = [];
    const queue = new MapsPriorityFairQueue(async (rows) => {
      postSizes.push(rows.length);
      return rows.map((r) => ({
        tag: r.tag,
        taskId: `id-${r.tag}`,
        request: r.request,
      }));
    });

    const prev = {
      min: process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS,
      max: process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS,
      coalesce: process.env.DATAFORSEO_MAPS_COALESCE_MS,
    };
    process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS = "0";
    process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS = "0";
    process.env.DATAFORSEO_MAPS_COALESCE_MS = "0";

    try {
      const posted = await queue.submitScan({
        scanKey: "solo",
        priority: 1,
        organizationId: "org1",
        rows: fakeRows(225, "S"),
      });
      assert.equal(posted.length, 225);
      assert.deepEqual(postSizes, [100, 100, 25]);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        const envKey =
          k === "min"
            ? "DATAFORSEO_MAPS_POST_DELAY_MIN_MS"
            : k === "max"
              ? "DATAFORSEO_MAPS_POST_DELAY_MAX_MS"
              : "DATAFORSEO_MAPS_COALESCE_MS";
        if (v == null) delete process.env[envKey];
        else process.env[envKey] = v;
      }
    }
  });

  it("contended submits interleave 25-cell slices", async () => {
    const posts: Array<{ size: number; scans: string[] }> = [];
    const queue = new MapsPriorityFairQueue(async (rows) => {
      const scans = [...new Set(rows.map((r) => r.tag.split("-")[0]!))];
      posts.push({ size: rows.length, scans });
      return rows.map((r) => ({
        tag: r.tag,
        taskId: `id-${r.tag}`,
        request: r.request,
      }));
    });

    const prev = {
      min: process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS,
      max: process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS,
      coalesce: process.env.DATAFORSEO_MAPS_COALESCE_MS,
    };
    process.env.DATAFORSEO_MAPS_POST_DELAY_MIN_MS = "0";
    process.env.DATAFORSEO_MAPS_POST_DELAY_MAX_MS = "0";
    process.env.DATAFORSEO_MAPS_COALESCE_MS = "20";

    try {
      const a = queue.submitScan({
        scanKey: "scanA",
        priority: 1,
        organizationId: "org1",
        rows: fakeRows(75, "A"),
      });
      const b = queue.submitScan({
        scanKey: "scanB",
        priority: 1,
        organizationId: "org1",
        rows: fakeRows(50, "B"),
      });

      const [postedA, postedB] = await Promise.all([a, b]);
      assert.equal(postedA.length, 75);
      assert.equal(postedB.length, 50);
      assert.ok(posts.some((p) => p.scans.includes("A") && p.scans.includes("B")));
      for (const post of posts) {
        assert.ok(post.size <= 100);
      }
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        const envKey =
          k === "min"
            ? "DATAFORSEO_MAPS_POST_DELAY_MIN_MS"
            : k === "max"
              ? "DATAFORSEO_MAPS_POST_DELAY_MAX_MS"
              : "DATAFORSEO_MAPS_COALESCE_MS";
        if (v == null) delete process.env[envKey];
        else process.env[envKey] = v;
      }
    }
  });
});
