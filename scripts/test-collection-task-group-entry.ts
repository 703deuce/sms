/**
 * TaskGroup collection entry routing and env flag.
 * Run: npx tsx scripts/test-collection-task-group-entry.ts
 */
import assert from "node:assert/strict";
import {
  receptionistTaskGroupCollectionEnabled,
} from "../voice-runtime/src/frontdesk/receptionist/collection-entry";

const originalLegacy = process.env.RECEPTIONIST_COLLECTION_LEGACY;

function resetEnv() {
  if (originalLegacy === undefined) {
    delete process.env.RECEPTIONIST_COLLECTION_LEGACY;
  } else {
    process.env.RECEPTIONIST_COLLECTION_LEGACY = originalLegacy;
  }
}

try {
  delete process.env.RECEPTIONIST_COLLECTION_LEGACY;
  assert.equal(receptionistTaskGroupCollectionEnabled(), true);
  assert.equal(receptionistTaskGroupCollectionEnabled({ skipFirstQuestion: true }), false);

  process.env.RECEPTIONIST_COLLECTION_LEGACY = "1";
  assert.equal(receptionistTaskGroupCollectionEnabled(), false);
  assert.equal(receptionistTaskGroupCollectionEnabled({ skipFirstQuestion: false }), false);

  delete process.env.RECEPTIONIST_COLLECTION_LEGACY;
  assert.equal(receptionistTaskGroupCollectionEnabled({ skipFirstQuestion: false }), true);

  console.log("test-collection-task-group-entry: all passed");
} finally {
  resetEnv();
}
