import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maxActiveMapsScansPerOrg } from "@/lib/queue/config";
import { resolveFreelancerLimits } from "@/lib/plans/resolve-freelancer-limits";

describe("serial maps scans per org", () => {
  it("defaults infrastructure concurrent cap to 1", () => {
    const prev = process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG;
    delete process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG;
    assert.equal(maxActiveMapsScansPerOrg(), 1);
    if (prev === undefined) delete process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG;
    else process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG = prev;
  });

  it("keeps freelancer and agency at one concurrent scan", () => {
    assert.equal(resolveFreelancerLimits("pro").maxConcurrentScans, 1);
    assert.equal(resolveFreelancerLimits("freelancer").maxConcurrentScans, 1);
    assert.equal(resolveFreelancerLimits("agency").maxConcurrentScans, 1);
    assert.equal(resolveFreelancerLimits("starter").maxConcurrentScans, 1);
  });
});
