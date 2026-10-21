import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const outFile = path.join("/opt/cursor/artifacts", "phase-4-scenarios-log.txt");

const snippet = `
import { runPhase4Scenarios } from "./phase-4-cross-feature-scenarios.ts";
const lines = [];
const record = (testId, feature, executed, expected, actual, status, evidence) => {
  lines.push([status, testId, executed, actual, evidence || ""].join(" | "));
};
runPhase4Scenarios(record);
console.log(lines.join("\\n"));
`;

const r = spawnSync("npx", ["tsx", "-e", snippet], {
  cwd: auditDir,
  encoding: "utf8",
  env: process.env,
});
writeFileSync(outFile, `${r.stdout}\n${r.stderr}`);
process.exit(r.status ?? 1);
