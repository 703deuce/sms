import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { INTEGRATION_PRINCIPLES, UI_AGENT_REPORTS_DIR } from "./config";
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

const INTEGRATION_SYSTEM = `You are integrating an APPROVED Kimi sandbox UI into Transovo PRODUCTION code.

${INTEGRATION_PRINCIPLES}

When planning changes:
- Treat Kimi files as the primary starting point for presentation — inspect concrete values (widths, max-widths, transition durations, classNames).
- Prefer modifying existing production components over creating duplicates.
- List state/handler swaps explicitly (Kimi mock → production hook/API).
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

APPROVED KIMI TARGET (visual source of truth): ${approved.target}
Compare production against this approved render — NOT the original competitor reference.

KIMI GENERATED FILES (starting implementation — reuse presentation, refactor wiring):
${generated.map((f) => `\n--- ${f.path} ---\n${f.content.slice(0, 4000)}`).join("\n")}

PRODUCTION FILES (existing hooks, components, APIs to preserve):
${productionContext}

For each Kimi component/section, identify:
1. Existing production component to merge into (if any)
2. Presentation to carry over (JSX, classNames, layout)
3. Production state/handlers/APIs to wire instead of Kimi mocks

Return JSON:
{
  "target": "...",
  "mappings": [
    {
      "kimiComponent": "ConversationList",
      "productionEquivalent": "src/components/...",
      "visualChanges": ["carry over Kimi sidebar width 316px", "..."],
      "realBehaviorToPreserve": ["useConversationFilters()", "pagination", "..."]
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
    userPrompt: `Generate PRODUCTION INTEGRATION PLAN.

USER INSTRUCTION: ${input.instruction || ""}

FUNCTIONAL MAPPING:
${JSON.stringify(input.mapping, null, 2)}

KIMI STARTING IMPLEMENTATION (reuse 80–90% presentation; refactor state/handlers/components as needed):
${generated.map((f) => `\n--- ${f.path} ---\n${f.content.slice(0, 5000)}`).join("\n")}

PRODUCTION CONTEXT:
${productionContext}

Return JSON:
{
  "summary": "...",
  "notes": ["which Kimi presentation was preserved", "which production hooks replaced Kimi state", "..."],
  "changes": [
    { "file": "src/components/...", "action": "modify", "reason": "merge Kimi JSX into existing ConversationRow", "content": "FULL FILE with real hooks/APIs" }
  ],
  "backendChangesRequired": [...]
}

Each production file must use real data hooks — no imports from .ui-agent/generated or mock-data.
Preserve approved visual appearance; do not preserve Kimi implementation details when production equivalents exist.`,
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
    "## Integration principles",
    INTEGRATION_PRINCIPLES,
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
