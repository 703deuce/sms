import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type CertRow = {
  route: string;
  page: string;
  tab: string;
  control: string;
  browserAction: string;
  uiResult: string;
  backendResult: string;
  refreshResult: string;
  effectiveRuntime: string;
  status: string;
  defectFix: string;
};

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function rowKey(row: Pick<CertRow, "page" | "tab" | "control">): string {
  return `${row.page}|${row.tab}|${row.control}`.toLowerCase();
}

export function loadSkipKeys(matrixPath: string): Set<string> {
  const skip = new Set<string>();
  if (!existsSync(matrixPath)) return skip;
  const text = readFileSync(matrixPath, "utf8");
  for (const line of text.split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 4) continue;
    const statusCol = cols.find((c) => c.startsWith("PASS") || c.startsWith("FAIL") || c.startsWith("CAPABILITY"));
    if (!statusCol?.startsWith("PASS")) continue;
    // Legacy 10-col: Page | Tab | Control | ...
    if (cols[1] && cols[2] && cols[3] && !cols[1].includes("Route")) {
      skip.add(`${cols[1]}|${cols[2]}|${cols[3]}`.toLowerCase());
    }
    // New 11-col: Route | Page | Tab | Control | ...
    if (cols[1] === "Route" || cols[2] === "Page") continue;
    if (cols.length >= 12 && cols[1].startsWith("/")) {
      skip.add(`${cols[2]}|${cols[3]}|${cols[4]}`.toLowerCase());
    }
  }
  return skip;
}

export function appendPhase2Header(matrixPath: string, sha: string, workspaceId: string): void {
  const marker = "## Phase 2 — full UI control manifest";
  if (existsSync(matrixPath) && readFileSync(matrixPath, "utf8").includes(marker)) return;
  const block = `

${marker}

**Production SHA (phase 2 start):** ${sha}  
**Workspace:** ${workspaceId}  
**Started:** ${new Date().toISOString()}

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
`;
  appendFileSync(matrixPath, block);
}

export function recordRow(matrixPath: string, row: CertRow, skipKeys: Set<string>): boolean {
  const key = rowKey(row);
  if (skipKeys.has(key)) return false;
  skipKeys.add(key);
  const line = `| ${esc(row.route)} | ${esc(row.page)} | ${esc(row.tab)} | ${esc(row.control)} | ${esc(row.browserAction)} | ${esc(row.uiResult)} | ${esc(row.backendResult)} | ${esc(row.refreshResult)} | ${esc(row.effectiveRuntime)} | ${esc(row.status)} | ${esc(row.defectFix)} |\n`;
  appendFileSync(matrixPath, line);
  return true;
}
