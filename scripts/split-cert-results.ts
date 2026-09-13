import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION-SCENARIO-RESULTS.txt");
const text = readFileSync(src, "utf8");
const introEnd = text.indexOf("SCENARIO 1:");
const intro = introEnd > 0 ? text.slice(0, introEnd) : "";
const rest = introEnd > 0 ? text.slice(introEnd) : text;
const scenarioBlocks = rest.split(/(?=^SCENARIO \d+:)/m).filter((b) => b.startsWith("SCENARIO"));
const outDir = join(process.cwd(), "docs/cert-results-copy-parts");
mkdirSync(outDir, { recursive: true });
const perPart = 8;
let partIndex = 0;
for (let i = 0; i < scenarioBlocks.length; i += perPart) {
  partIndex++;
  const partNum = String(partIndex).padStart(2, "0");
  const slice = scenarioBlocks.slice(i, i + perPart);
  const from = i + 1;
  const to = Math.min(i + perPart, scenarioBlocks.length);
  const header =
    partIndex === 1
      ? intro
      : `MCTB E2E RESULTS — PART ${partNum} (scenarios ${from}-${to} of ${scenarioBlocks.length})\n\n`;
  writeFileSync(join(outDir, `MCTB-E2E-RESULTS-PART-${partNum}.txt`), header + slice.join("\n"));
}
writeFileSync(
  join(outDir, "README.txt"),
  `Open one PART file at a time to copy (8 scenarios each).\nFull report: ../MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION-SCENARIO-RESULTS.txt\nParts: ${partIndex}\n`,
);
console.log(`Wrote ${partIndex} parts to ${outDir}`);
