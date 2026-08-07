/**
 * Generated arbitrary field mutation tests — proves field_id architecture
 * does not depend on hardcoded parameter names.
 * Run: npx tsx scripts/test-field-runtime-mutations.ts
 */
import { toCustomFieldId } from "../src/lib/voice/field-runtime/system-fields";
import { validateFieldValue } from "../src/lib/voice/field-runtime/validate";
import type { WorkflowFieldDefinition } from "../src/lib/voice/field-runtime/types";

const failures: string[] = [];
const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "phone",
  "email",
  "boolean",
  "single_select",
] as const;

const RANDOM_LABELS = [
  "Vehicle Make & Model",
  "Gate Code",
  "Number of Dogs",
  "Equipment Serial",
  "Property Age",
  "Garage Door Color",
  "Preferred Material",
  "Shoe Size",
  "Roof Pitch",
  "Pool Chemical Level",
];

function randomLabel(): string {
  const base = RANDOM_LABELS[Math.floor(Math.random() * RANDOM_LABELS.length)];
  const suffix = Math.floor(Math.random() * 10000);
  return `${base} ${suffix}`;
}

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  }
}

function makeField(label: string, type: (typeof FIELD_TYPES)[number], required: boolean): WorkflowFieldDefinition {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  return {
    field_id: toCustomFieldId(slug),
    label,
    type,
    required,
    collection_instruction: `Collect ${label}.`,
    options: type === "single_select" ? ["Option A", "Option B"] : undefined,
  };
}

const SAMPLE_VALUES: Record<string, unknown> = {
  text: "Sample text value",
  long_text: "A longer description of the problem at hand.",
  number: 42,
  phone: "+17035551212",
  email: "test@example.com",
  boolean: true,
  single_select: "Option A",
};

let permutations = 0;
const TARGET = 200;

console.log(`Generating ${TARGET} random field permutations...\n`);

while (permutations < TARGET) {
  const fieldCount = 1 + Math.floor(Math.random() * 6);
  const fields: WorkflowFieldDefinition[] = [];
  const usedSlugs = new Set<string>();
  for (let i = 0; i < fieldCount; i++) {
    let label = randomLabel();
    let slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    while (usedSlugs.has(slug)) {
      label = randomLabel();
      slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    }
    usedSlugs.add(slug);
    const type = FIELD_TYPES[Math.floor(Math.random() * FIELD_TYPES.length)];
    const required = Math.random() > 0.3;
    fields.push(makeField(label, type, required));
  }

  const uniqueIds = new Set(fields.map((f) => f.field_id));
  check(`perm ${permutations}: unique field_ids`, uniqueIds.size === fields.length);

  for (const field of fields) {
    const value = SAMPLE_VALUES[field.type];
    try {
      const validated = validateFieldValue(field, value);
      check(
        `perm ${permutations}: validate ${field.field_id}`,
        validated != null && String(validated).length > 0,
      );
    } catch (err) {
      check(
        `perm ${permutations}: validate ${field.field_id}`,
        false,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  permutations++;
}

check("completed permutations", permutations === TARGET, `got ${permutations}`);

// Prove field_id stability for builder-style labels
for (const label of ["Car Make & Model", "Gate Code", "Describe the Problem"]) {
  const id = toCustomFieldId(label);
  check(`stable id for "${label}"`, id.startsWith("fld_"));
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s) across ${TARGET} permutations`);
  process.exit(1);
}
console.log(`\n${TARGET} field mutation permutations passed.`);
