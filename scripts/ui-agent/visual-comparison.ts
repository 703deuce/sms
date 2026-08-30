import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { INTEGRATION_PRINCIPLES, UI_AGENT_REPORTS_DIR } from "./config";
import { buildLabeledMedia } from "./reference-media";
import type { LabeledMedia, UiVisionProvider, VisualVerificationScores } from "./types";

export async function compareApprovedReferenceToProduction(
  provider: UiVisionProvider,
  input: {
    approvedScreenshotPath: string;
    productionScreenshotPath: string;
    target: string;
    instruction?: string;
  },
): Promise<VisualVerificationScores & { majorDifferences: string[]; faithful: boolean }> {
  const media = buildLabeledMedia([
    {
      path: input.approvedScreenshotPath,
      label: "APPROVED_KIMI_REFERENCE",
      purpose: "Frozen Kimi sandbox implementation",
    },
    {
      path: input.productionScreenshotPath,
      label: "PRODUCTION_TRANSOVO_AFTER",
      purpose: "Production page after Cursor integration",
    },
  ]);

  const result = await provider.analyze({
    systemPrompt: `You compare screenshots for post-integration fidelity. Do NOT redesign.
The APPROVED KIMI sandbox render is the target — NOT the original competitor reference.`,
    userPrompt: `FINAL VISUAL COMPARISON — integration fidelity check

${INTEGRATION_PRINCIPLES}

TARGET ROUTE: ${input.target}
INSTRUCTION: ${input.instruction || ""}

Compare PRODUCTION_TRANSOVO_AFTER against APPROVED_KIMI_REFERENCE.
Did integration preserve the approved Kimi visual result while using real production data?

Return JSON:
{
  "visualMatch": 0-100,
  "layoutMatch": 0-100,
  "interactionMatch": 0-100,
  "brandPreservation": 0-100,
  "functionalityRisk": "low|medium|high",
  "remainingDifferences": ["..."],
  "majorDifferences": ["..."],
  "faithful": true|false
}`,
    labeledMedia: media,
    expectJson: true,
  });

  return (result.parsedJson || {
    visualMatch: 0,
    layoutMatch: 0,
    interactionMatch: 0,
    brandPreservation: 0,
    functionalityRisk: "high",
    remainingDifferences: [],
    majorDifferences: ["Parse failed"],
    faithful: false,
  }) as VisualVerificationScores & { majorDifferences: string[]; faithful: boolean };
}

export function writeVisualComparisonReport(
  sessionId: string,
  scores: VisualVerificationScores & { majorDifferences: string[]; faithful: boolean },
): string {
  const path = join(UI_AGENT_REPORTS_DIR, `${sessionId}-visual-comparison.md`);
  const lines = [
    `# Visual Comparison — ${sessionId}`,
    "",
    "Target: **approved Kimi sandbox render** vs **production after integration**",
    "",
    `- Faithful: **${scores.faithful ? "yes" : "no"}**`,
    `- Visual match: ${scores.visualMatch}/100`,
    `- Layout match: ${scores.layoutMatch}/100`,
    `- Interaction match: ${scores.interactionMatch}/100`,
    `- Brand preservation: ${scores.brandPreservation}/100`,
    `- Functionality risk: ${scores.functionalityRisk}`,
    "",
    "## Major differences",
    ...(scores.majorDifferences.length ? scores.majorDifferences.map((d) => `- ${d}`) : ["- (none noted)"]),
    "",
    "## Remaining differences",
    ...(scores.remainingDifferences.length ? scores.remainingDifferences.map((d) => `- ${d}`) : ["- (none noted)"]),
    "",
    "```json",
    JSON.stringify(scores, null, 2),
    "```",
  ];
  writeFileSync(path, lines.join("\n"), "utf8");
  return path;
}
