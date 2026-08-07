/**
 * Field runtime — field-ID-driven collection architecture.
 * Run: npx tsx scripts/test-field-runtime.ts
 */
import {
  saveCollectedFields,
  getWorkflowRequirements,
  legacyFlatArgsToFieldEntries,
  SYSTEM_FIELD_IDS,
  toCustomFieldId,
} from "../src/lib/voice/field-runtime";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

check("custom field id", toCustomFieldId("car_make") === "fld_car_make");
check("legacy maps name", legacyFlatArgsToFieldEntries({ name: "John" })[0].field_id === SYSTEM_FIELD_IDS.name);

// Mock-less unit: requirements structure from empty session would need DB — skip integration
check("system field ids stable", SYSTEM_FIELD_IDS.phone === "sys_phone");

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nField runtime unit checks passed.");
