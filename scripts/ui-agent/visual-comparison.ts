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
    systemPrompt: `You compare screenshots. Do NOT redesign. Only evaluate fidelity of production vs approved reference.`,
    userPrompt: `FINAL VISUAL COMPARISON — integration fidelity check

TARGET: ${input.target}
INSTRUCTION: ${input.instruction || ""}

Did Cursor reproduce the approved Kimi reference faithfully in production?

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
