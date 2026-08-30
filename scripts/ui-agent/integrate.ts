import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_REPORTS_DIR } from "./config";
import { readAllGeneratedSources } from "./generated-sandbox";
import { loadApprovedReference } from "./approve-reference";
import { manifestToPromptContext } from "./project-context";
import { assertAllowedChangePath, normalizeRepoRelativePath } from "./path-guards";
import type {
  FunctionalMappingReport,
  ImplementationPlan,
  ProjectManifest,
  UiVisionProvider,
} from "./types";

const INTEGRATION_SYSTEM = `You are integrating an APPROVED Kimi visual reference into Transovo PRODUCTION code.

CRITICAL RULES:
- The Kimi sandbox (.ui-agent/generated/) is the VISUAL SOURCE OF TRUTH.
- Reproduce Kimi's layout, spacing, classNames, component hierarchy, modals, and visual states faithfully.
- Connect to EXISTING production hooks, API calls, handlers, and real data.
- NEVER copy mock-data.ts, MOCK_* constants, or fake handlers from the sandbox into production.
- NEVER modify src/lib, src/app/api, prisma, or backend logic.
- If new backend capability is required, list it under backendChangesRequired — do not fake it.

Return JSON only.`;

export async function generateFunctionalMappingReport(
  provider: UiVisionProvider,
  input: { sessionId: string; manifest: ProjectManifest },
): Promise<FunctionalMappingReport> {
  const approved = loadApprovedReference(input.sessionId);
  const generated = readAllGeneratedSources(input.sessionId);
  const productionContext = manifestToPromptContext(input.manifest);

  const result = await provider.analyze({
    systemPrompt: INTEGRATION_SYSTEM,
    userPrompt: `Create a FUNCTIONAL MAPPING REPORT before integration.

APPROVED REFERENCE TARGET: ${approved.target}

KIMI GENERATED FILES:
${generated.map((f) => `\n--- ${f.path} ---\n${f.content.slice(0, 4000)}`).join("\n")}

PRODUCTION FILES:
${productionContext}

Return JSON:
{
  "target": "...",
  "mappings": [
    {
      "kimiComponent": "ConversationList",
      "productionEquivalent": "src/components/...",
      "visualChanges": ["..."],
      "realBehaviorToPreserve": ["pagination", "search", "..."]
    }
  ],
  "backendChangesRequired": [{ "feature": "...", "reason": "..." }],
  "mockDataMustNotCopy": ["mock-data.ts", "..."],
  "notes": ["..."]
}`,
    labeledMedia: [],
    expectJson: true,
  });

  return (result.parsedJson || { target: approved.target, mappings: [] }) as FunctionalMappingReport;
}

export async function generateIntegrationPlan(
  provider: UiVisionProvider,
  input: {
    sessionId: string;
    manifest: ProjectManifest;
    mapping: FunctionalMappingReport;
    instruction: string;
  },
): Promise<ImplementationPlan> {
  const approved = loadApprovedReference(input.sessionId);
  const generated = readAllGeneratedSources(input.sessionId);
  const productionContext = manifestToPromptContext(input.manifest);

  const result = await provider.analyze({
    systemPrompt: INTEGRATION_SYSTEM,
    userPrompt: `Generate PRODUCTION INTEGRATION PLAN (presentation transplant only).

USER INSTRUCTION: ${input.instruction || ""}

FUNCTIONAL MAPPING:
${JSON.stringify(input.mapping, null, 2)}

KIMI REFERENCE (visual source of truth):
${generated.map((f) => `\n--- ${f.path} ---\n${f.content.slice(0, 5000)}`).join("\n")}

PRODUCTION CONTEXT:
${productionContext}

Return JSON:
{
  "summary": "...",
  "notes": ["..."],
  "changes": [
    { "file": "src/components/...", "action": "modify", "reason": "...", "content": "FULL FILE with real hooks/APIs" }
  ],
  "backendChangesRequired": [...]
}

Each production file must use real data hooks — no imports from .ui-agent/generated or mock-data.`,
    labeledMedia: [],
    expectJson: true,
  });

  const plan = (result.parsedJson || { summary: "", notes: [], changes: [] }) as ImplementationPlan;
  validateIntegrationPlan(plan);
  return plan;
}

export function validateIntegrationPlan(plan: ImplementationPlan): void {
  for (const change of plan.changes) {
    const rel = normalizeRepoRelativePath(change.file);
    assertAllowedChangePath(rel);
    const content = change.content || "";
    if (/\.ui-agent\/generated|mock-data|MOCK_[A-Z_]+/i.test(content)) {
      throw new Error(`Integration plan illegally references sandbox mock data in ${rel}`);
    }
    if (/from\s+["'].*mock-data/i.test(content)) {
      throw new Error(`Integration plan imports mock-data in ${rel}`);
    }
  }
}

export function writeIntegrationReport(sessionId: string, mapping: FunctionalMappingReport, plan?: ImplementationPlan): string {
  const path = join(UI_AGENT_REPORTS_DIR, `${sessionId}-integration.md`);
  const lines = [
    `# Integration Report — ${mapping.target}`,
    "",
    "## Functional mapping",
    "```json",
    JSON.stringify(mapping, null, 2),
    "```",
  ];
  if (plan) {
    lines.push("", "## Integration plan", "```json", JSON.stringify(plan, null, 2), "```");
  }
  writeFileSync(path, lines.join("\n"), "utf8");
  return path;
}
