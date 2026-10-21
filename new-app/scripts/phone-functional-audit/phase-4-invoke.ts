import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runPhase4Scenarios } from "./phase-4-cross-feature-scenarios.ts";

const out = process.env.PHASE_4_RESULTS || "/opt/cursor/artifacts/phase-4-results.json";
const rows: unknown[] = [];
const record = (
  testId: string,
  feature: string,
  executed: string,
  expected: string,
  actual: string,
  status: string,
  evidence?: string,
) => {
  rows.push({ testId, feature, executed, expected, actual, status, evidence });
};

await runPhase4Scenarios(record);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows, null, 2));
