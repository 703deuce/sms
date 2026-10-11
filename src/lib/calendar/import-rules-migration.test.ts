import assert from "node:assert/strict";
import {
  IMPORT_RULES_SCHEMA_VERSION,
  isLegacyImplicitImportRules,
  legacyImplicitImportRules,
  mergeImportRulesWithMigration,
  migrateStoredImportRules,
} from "./import-rules-migration";
import { defaultImportRules } from "./eligibility";
import type { CalendarConfig } from "./providers";

assert.equal(IMPORT_RULES_SCHEMA_VERSION, 2);

const legacy = legacyImplicitImportRules();
assert.equal(legacy.requireExternalAttendees, true);
assert.equal(legacy.requireOrganizerIsConnection, true);

const permissive = defaultImportRules();
assert.equal(permissive.requireExternalAttendees, false);
assert.equal(permissive.requireOrganizerIsConnection, false);
assert.equal(permissive.useBuiltinTitleExcludes, false);

assert.equal(isLegacyImplicitImportRules(undefined), true);
assert.equal(isLegacyImplicitImportRules(legacy), true);
assert.equal(
  isLegacyImplicitImportRules({ ...legacy, requireExternalAttendees: false }),
  false,
);

assert.deepEqual(migrateStoredImportRules(legacy), permissive);
assert.equal(
  migrateStoredImportRules({ ...legacy, requireExternalAttendees: false }).requireExternalAttendees,
  false,
);
assert.equal(
  migrateStoredImportRules({ ...legacy, requireOrganizerIsConnection: true })
    .requireOrganizerIsConnection,
  false,
);

const configV1: CalendarConfig = {
  importRules: legacy,
  importRulesSchemaVersion: 1,
};
const merged = mergeImportRulesWithMigration(configV1);
assert.equal(merged.requireExternalAttendees, false);

const configV2: CalendarConfig = {
  importRules: { requireExternalAttendees: true },
  importRulesSchemaVersion: 2,
};
assert.equal(mergeImportRulesWithMigration(configV2).requireExternalAttendees, true);

console.log("import-rules-migration.test.ts: ok");
