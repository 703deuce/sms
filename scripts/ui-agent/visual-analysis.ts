import { DESIGN_REFERENCE_DEFAULT_INSTRUCTION } from "./config";
import { manifestToPromptContext } from "./project-context";
import type {
  DifferencePlan,
  LabeledMedia,
  ProjectManifest,
  ReferenceAnalysis,
  UiVisionProvider,
  VisualVerificationScores,
} from "./types";

const SYSTEM_PROMPT = `You are a senior product UI/visual analyst for Transovo, an existing production SaaS application.
You analyze screenshots and videos to improve EXISTING pages — never to rebuild the app from scratch.
Preserve Transovo branding, terminology, navigation labels, and backend behavior.
Return valid JSON only when asked. Mark uncertain observations explicitly.`;

export async function analyzeReferenceMedia(
  provider: UiVisionProvider,
  referenceMedia: LabeledMedia[],
  instruction: string,
): Promise<ReferenceAnalysis> {
  const result = await provider.analyze({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `PASS 1 — REFERENCE ANALYSIS

${DESIGN_REFERENCE_DEFAULT_INSTRUCTION}

USER INSTRUCTION:
${instruction || "(none)"}

Analyze ONLY the labeled REFERENCE media. Do not assume backend capabilities.
Return JSON with keys:
pagesSeen, layout, navigation, components, typography, spacing, hierarchy, tables, cards, forms, modals, dropdowns, tabs, filters, emptyStates, loadingStates, interactions, transitions, responsiveBehavior, visualPatterns, assets, uncertainObservations, videoSequence

For video, describe visible sequence, clicks, modals, dropdowns, scrolling, and state changes. Do not invent interactions not visible.`,
    labeledMedia: referenceMedia,
    expectJson: true,
  });

  return (result.parsedJson || {}) as ReferenceAnalysis;
}

export async function buildDifferencePlan(
  provider: UiVisionProvider,
  input: {
    referenceAnalysis: ReferenceAnalysis;
    currentMedia: LabeledMedia[];
    manifest: ProjectManifest;
    instruction: string;
  },
): Promise<DifferencePlan> {
  const codeContext = manifestToPromptContext(input.manifest);
  const result = await provider.analyze({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `PASS 2 — CURRENT TRANSOVO VS REFERENCE

TARGET: ${input.manifest.targetRoute}

USER INSTRUCTION:
${input.instruction || "(none)"}

REFERENCE ANALYSIS:
${JSON.stringify(input.referenceAnalysis, null, 2)}

CURRENT TRANSOVO CODE CONTEXT:
${codeContext}

Compare CURRENT_TRANSOVO labeled screenshots against the reference analysis.
Produce a structured difference plan JSON with keys:
target, preserve, modify (array of {area, current, reference, change, priority}), add, remove, reuseComponents, newPresentationComponents, interactionChanges, responsiveChanges, backendChangesRequired (array of {feature, reason}), outOfScope, uncertainties, inScope

Rules:
- Preserve existing API calls, routing, auth, IDs, and backend behavior.
- If reference needs unsupported backend behavior, list under backendChangesRequired — do NOT fake it.
- Reuse existing Transovo components from the design system when possible.
- Do not redesign unrelated routes.`,
    labeledMedia: input.currentMedia,
    expectJson: true,
  });

  const plan = (result.parsedJson || {}) as DifferencePlan;
  plan.target = plan.target || input.manifest.targetRoute;
  return plan;
}

export async function generateImplementationPlan(
  provider: UiVisionProvider,
  input: {
    differencePlan: DifferencePlan;
    manifest: ProjectManifest;
    instruction: string;
  },
): Promise<{ changes: Array<{ file: string; action: "modify" | "create"; reason: string; content: string }>; summary: string; notes: string[] }> {
  const codeContext = manifestToPromptContext(input.manifest);
  const result = await provider.analyze({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `IMPLEMENTATION PLAN — UI ONLY

${input.instruction || ""}

DIFFERENCE PLAN:
${JSON.stringify(input.differencePlan, null, 2)}

CODE CONTEXT:
${codeContext}

Return JSON:
{
  "summary": "...",
  "notes": ["..."],
  "changes": [
    { "file": "src/...", "action": "modify|create", "reason": "...", "content": "FULL FILE CONTENT" }
  ]
}

Rules:
- Only modify presentation files under src/app or src/components.
- Never modify src/lib, src/app/api, prisma, or backend logic.
- Never add fake data or mock API calls.
- Reuse existing Button, Input, Modal, Table, Card, Tabs from src/components/ui.
- Provide complete file contents for each changed file.`,
    labeledMedia: [],
    expectJson: true,
  });

  const parsed = (result.parsedJson || {}) as {
    summary?: string;
    notes?: string[];
    changes?: Array<{ file: string; action: "modify" | "create"; reason: string; content: string }>;
  };

  return {
    summary: parsed.summary || "UI implementation plan",
    notes: parsed.notes || [],
    changes: parsed.changes || [],
  };
}

export async function verifyVisualImprovement(
  provider: UiVisionProvider,
  input: {
    referenceMedia: LabeledMedia[];
    beforeMedia: LabeledMedia[];
    afterMedia: LabeledMedia[];
    instruction: string;
    target: string;
  },
): Promise<VisualVerificationScores> {
  const result = await provider.analyze({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `VISUAL VERIFICATION

TARGET: ${input.target}
INSTRUCTION: ${input.instruction || "(none)"}

Compare REFERENCE, BEFORE (Transovo), and AFTER (Transovo) labeled media.
Return JSON:
{
  "visualMatch": 0-100,
  "layoutMatch": 0-100,
  "interactionMatch": 0-100,
  "brandPreservation": 0-100,
  "functionalityRisk": "low|medium|high",
  "remainingDifferences": ["..."]
}`,
    labeledMedia: [...input.referenceMedia, ...input.beforeMedia, ...input.afterMedia],
    expectJson: true,
  });

  return (result.parsedJson || {
    visualMatch: 0,
    layoutMatch: 0,
    interactionMatch: 0,
    brandPreservation: 0,
    functionalityRisk: "medium",
    remainingDifferences: ["Verification JSON parse failed"],
  }) as VisualVerificationScores;
}
