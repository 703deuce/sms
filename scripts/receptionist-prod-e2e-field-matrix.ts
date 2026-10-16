/**
 * Generate field verification matrix scaffold from field-registry (111 top-level fields).
 * Run: npx tsx scripts/receptionist-prod-e2e-field-matrix.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { listTopLevelRegistryEntries } from "@/lib/solutions/appointment-receptionist/config-tracing/field-registry";

const ARTIFACT = "/opt/cursor/artifacts";
const OUT = `${ARTIFACT}/receptionist-field-verification-matrix.json`;

const STEP_BY_OWNER: Record<string, string> = {
  goals: "goals",
  phone: "phone",
  information: "information",
  appointments: "appointments",
  "call-handling": "call-handling",
  voice: "voice",
  test: "test",
  activate: "activate",
  shared: "multiple",
};

function main() {
  mkdirSync(ARTIFACT, { recursive: true });
  const entries = listTopLevelRegistryEntries();
  const rows = entries.map((e) => ({
    path: e.path,
    wizardStep: STEP_BY_OWNER[e.owner] ?? e.owner,
    owner: e.owner,
    status: "NOT_TESTED",
    originalValue: null,
    newValue: null,
    uiChangeTrace: null,
    apiTraceId: null,
    mergeResult: null,
    persistedValue: null,
    afterReload: null,
    publishEffect: null,
    runtimeValue: null,
    behavioralResult: null,
    notes: "",
  }));
  const summary = {
    generatedAt: new Date().toISOString(),
    topLevelFieldCount: rows.length,
    statusCounts: { NOT_TESTED: rows.length },
  };
  writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
  console.log("Wrote", OUT, "fields=", rows.length);
}

main();
