import assert from "node:assert/strict";
import {
  ADD_EXCLUSION_REASON_PRESETS,
  canRemoveExclusion,
  EXCLUSIONS_DEFAULT_PAGE_SIZE,
  exclusionSummary,
  filterExclusions,
  formatExclusionReasonLabel,
  formatExclusionSourceLabel,
  paginateExclusions,
  sortExclusions,
} from "../src/lib/mctb/setup-exclusions-model";
import { GLOBAL_TABLE_DEFAULT_PAGE_SIZE } from "../src/lib/ui/global-data-table";
import { resolveMctbSetupSectionId } from "../src/lib/mctb/setup-sections";

assert.equal(resolveMctbSetupSectionId("/mctb/setup/exclusions"), "exclusions");
assert.equal(EXCLUSIONS_DEFAULT_PAGE_SIZE, 10);
assert.equal(GLOBAL_TABLE_DEFAULT_PAGE_SIZE, 10);

const sample = [
  {
    id: "1",
    phone: "+15715550142",
    reason: "Blocked from voicemail",
    source: "mctb_exclusion",
    createdAt: "2026-09-12T16:22:00.000Z",
  },
  {
    id: "2",
    phone: "+17035550199",
    reason: "Do not text",
    source: "mctb_exclusion",
    createdAt: "2026-09-11T10:00:00.000Z",
  },
  {
    id: "3",
    phone: "+12025550100",
    reason: "blocked_by_user",
    source: "personal_blocked",
    createdAt: "2026-09-10T08:00:00.000Z",
  },
];

assert.equal(formatExclusionReasonLabel("Do not text"), "Manual exclusion");
assert.equal(formatExclusionSourceLabel("mctb_exclusion", "Blocked from voicemail"), "Voicemail");
assert.equal(formatExclusionSourceLabel("personal_blocked", null), "Personal");
assert.equal(canRemoveExclusion(sample[2]), false);
assert.equal(canRemoveExclusion(sample[0]), true);

const filtered = filterExclusions(sample, {
  search: "571",
  source: "all",
  origin: "all",
  reason: "all",
});
assert.equal(filtered.length, 1);

const voicemailOnly = filterExclusions(sample, {
  search: "",
  source: "all",
  origin: "voicemail",
  reason: "all",
});
assert.equal(voicemailOnly.length, 1);

const sorted = sortExclusions(sample, "phone_asc");
assert.equal(sorted[0].phone, "+12025550100");

const page5 = paginateExclusions(sorted, 1, 5);
assert.equal(page5.pageRows.length, 3);

const many = Array.from({ length: 12 }, (_, i) => ({
  ...sample[0],
  id: String(i),
  phone: `+1571555${String(i).padStart(4, "0")}`,
}));
const page10 = paginateExclusions(many, 1, 10);
assert.equal(page10.pageRows.length, 10);

const summary = exclusionSummary(sample);
assert.equal(summary.total, 3);
assert.equal(summary.mctb, 2);
assert.equal(summary.personal, 1);

assert.ok(ADD_EXCLUSION_REASON_PRESETS.length >= 3);

console.log("test-mctb-setup-exclusions: ok");
