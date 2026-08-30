import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { generatedDirForSession, listGeneratedFiles } from "./generated-sandbox";
import { loadApprovedReference } from "./approve-reference";
import { sessionDir } from "./session";
import type { UiAgentSession } from "./types";

export type UiHandoff = {
  sessionId: string;
  targetRoute: string;
  status: string;
  instruction: string;
  productionFiles: string[];
  generatedFiles: string[];
  generatedPath: string;
  screenshots: {
    approvedKimi?: string;
    currentTransovo?: string[];
    productionAfter?: string[];
  };
  referenceMedia: UiAgentSession["referenceMedia"];
  approvedAt?: string;
  mockFunctionality: string[];
  backendAssumptions: string[];
  integrationPrinciples: string;
  cursorInstruction: string;
};

export function writeHandoff(session: UiAgentSession, extra?: Partial<UiHandoff>): string {
  const generatedPath = session.generatedDir || generatedDirForSession(session.id);
  const generatedFiles = listGeneratedFiles(session.id);

  let approvedAt: string | undefined;
  try {
    const approved = loadApprovedReference(session.id);
    approvedAt = approved.approvedAt;
  } catch {
    // not approved yet
  }

  const kimiScreenshot = join(generatedPath, "screenshot.png");
  const currentCaptures = session.currentMedia.map((m) => m.path);
  const afterDir = join(sessionDir(session.id), "after-integrate");
  const productionAfter = existsSync(afterDir)
    ? session.currentMedia.map((_, i) => join(afterDir, `current-desktop.png`)).filter((p) => existsSync(p))
    : [];

  const handoff: UiHandoff = {
    sessionId: session.id,
    targetRoute: session.target,
    status: session.status || (session.approved ? "approved" : "ready"),
    instruction: session.instruction,
    productionFiles: session.manifest.targetFiles,
    generatedFiles,
    generatedPath,
    screenshots: {
      approvedKimi: existsSync(kimiScreenshot) ? kimiScreenshot : undefined,
      currentTransovo: currentCaptures,
      productionAfter,
    },
    referenceMedia: session.referenceMedia,
    approvedAt,
    mockFunctionality: [
      "Kimi sandbox may use mock-data.ts and local useState — replace with production hooks/APIs during integration.",
    ],
    backendAssumptions: session.implementationPlan?.backendChangesRequired?.map((b) => `${b.feature}: ${b.reason}`) || [],
    integrationPrinciples: "Reuse Kimi presentation; preserve approved visual result; connect real Transovo data/handlers.",
    cursorInstruction: `Integrate approved UI session ${session.id} for route ${session.target}. Compare against approved Kimi screenshot, not the original competitor reference.`,
    ...extra,
  };

  const jsonPath = join(sessionDir(session.id), "HANDOFF.json");
  const mdPath = join(sessionDir(session.id), "HANDOFF.md");

  writeFileSync(jsonPath, JSON.stringify(handoff, null, 2), "utf8");
  writeFileSync(
    mdPath,
    [
      `# UI Handoff — ${session.id}`,
      "",
      `**Target:** ${handoff.targetRoute}`,
      `**Status:** ${handoff.status}`,
      "",
      "## Cursor instruction",
      handoff.cursorInstruction,
      "",
      "## Generated files",
      ...handoff.generatedFiles.map((f) => `- \`${join(handoff.generatedPath, f)}\``),
      "",
      "## Production files",
      ...handoff.productionFiles.map((f) => `- \`${f}\``),
      "",
      "## Integration",
      handoff.integrationPrinciples,
      "",
      handoff.instruction ? `User instruction: ${handoff.instruction}` : "",
    ].join("\n"),
    "utf8",
  );

  return jsonPath;
}
