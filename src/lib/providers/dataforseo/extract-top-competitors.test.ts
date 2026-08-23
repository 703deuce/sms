import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTopCompetitors, type MapsLiveResult } from "@/lib/providers/dataforseo";

describe("extractTopCompetitors", () => {
  it("persists main_image, total_photos, and other Maps listing fields", () => {
    const items: MapsLiveResult[] = [
      {
        rank_group: 1,
        title: "City Junk Removal",
        place_id: "ChIJabc",
        cid: "123",
        rating: { value: 4.8, votes_count: 210 },
        category: "Junk removal service",
        additional_categories: ["Waste management service"],
        address: "123 Main St",
        snippet: "123 Main St",
        phone: "+15551234567",
        url: "https://example.com",
        domain: "example.com",
        main_image: "https://lh5.googleusercontent.com/p/AF1QipExample=w408-h306",
        total_photos: 42,
        latitude: 38.66,
        longitude: -77.35,
        is_claimed: true,
        price_level: "moderate",
        local_justifications: [{ type: "user_review", text: "Great service" }],
      },
    ];

    const [row] = extractTopCompetitors(items);
    assert.equal(row.name, "City Junk Removal");
    assert.equal(row.main_image, items[0]!.main_image);
    assert.equal(row.total_photos, 42);
    assert.equal(row.is_claimed, true);
    assert.equal(row.price_level, "moderate");
    assert.equal(row.lat, 38.66);
    assert.equal(row.lng, -77.35);
    assert.deepEqual(row.additional_categories, ["Waste management service"]);
    assert.equal(row.domain, "example.com");
  });
});
