#!/usr/bin/env npx tsx
import { bookingSystemFieldIds } from "../src/lib/voice/field-runtime/loader";
import { loadWorkflowFieldDefinitions } from "../src/lib/voice/field-runtime/loader";
import { SYSTEM_FIELD_IDS } from "../src/lib/voice/field-runtime/system-fields";

const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (!cond) {
    failures.push(name);
    console.error("✗", name);
  } else {
    console.log("✓", name);
  }
}

const base = bookingSystemFieldIds(false);
check("base booking includes name", base.includes(SYSTEM_FIELD_IDS.name));
check("base booking includes phone", base.includes(SYSTEM_FIELD_IDS.phone));
check("base booking excludes email without calendly", !base.includes(SYSTEM_FIELD_IDS.email));

const calendly = bookingSystemFieldIds(true);
check("calendly booking includes email", calendly.includes(SYSTEM_FIELD_IDS.email));

async function main() {
  const defs = await loadWorkflowFieldDefinitions({
    workspaceId: "ws_1",
    agentId: "cmshz2lc25c622c4i58303501",
    workflow: "book_appointment",
  });
  const ids = defs.map((d) => d.field_id);
  const problemIdx = ids.findIndex((id) => id.startsWith("fld_"));
  const nameIdx = ids.indexOf(SYSTEM_FIELD_IDS.name);
  const emailIdx = ids.indexOf(SYSTEM_FIELD_IDS.email);
  check(
    "booking field order: problem before name and email",
    problemIdx >= 0 && nameIdx > problemIdx && emailIdx > nameIdx,
  );
}

main()
  .then(() => {
    console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
    if (failures.length) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
