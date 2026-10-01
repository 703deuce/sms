import assert from "node:assert/strict";
import { parseMctbHandoffResponse } from "../src/lib/mctb/handoff/parse-handoff-response";
import { defaultHandoffConfig } from "../src/lib/mctb/handoff/defaults";

const cfg = defaultHandoffConfig();
const recipients = [
  {
    id: "r1",
    name: "Test",
    email: "a@example.com",
    mobileE164: "+15550101010",
    roleDescription: null,
    eventChannels: {},
    enabled: true,
    sortOrder: 0,
  },
];

const wrapped = parseMctbHandoffResponse({ data: { config: cfg, recipients, launch: { urgentBusinessSmsEntitled: false } } });
assert.equal(wrapped.recipients.length, 1);
assert.equal(wrapped.recipients[0].email, "a@example.com");
assert.equal(wrapped.launch?.urgentBusinessSmsEntitled, false);

const flat = parseMctbHandoffResponse({ config: cfg, recipients });
assert.equal(flat.recipients.length, 1);

const empty = parseMctbHandoffResponse({});
assert.deepEqual(empty.recipients, []);
assert.equal(empty.config, null);

console.log("test-mctb-handoff-parse-response: ok");
