import { DESIGN_REFERENCE_DEFAULT_INSTRUCTION } from "./config";
import { writeGeneratedFiles } from "./generated-sandbox";
import { designContextForKimi } from "./project-context";
import type { LabeledMedia, ProjectManifest, UiVisionProvider } from "./types";

export type ReferenceBuildResult = {
  files: string[];
  summary: string;
};

const REFERENCE_BUILD_SYSTEM = `You are building a COMPLETE VISUAL REFERENCE IMPLEMENTATION inside an EXISTING Next.js application.
This is NOT production code. It lives in a sandbox only (.ui-agent/generated/).

CRITICAL — DO NOT SCAFFOLD A NEW PROJECT:
- Do NOT create package.json, tsconfig, next.config, tailwind.config, or root app files
- Do NOT initialize Next.js, Tailwind, or a new routing architecture
- Generate ONLY: page.tsx, components/**, mock-data.ts, reference.css, README.md

Your job: write runnable React/TSX + CSS that recreates the reference UI as faithfully as possible.
You MAY use mock/static data (mock-data.ts) in this sandbox.
You MUST NOT output prose-only design specs — output actual code files.

Prefer existing project conventions (Tailwind className tokens: bg-card, text-foreground, border-border).
Use lucide-react icons if needed — do not add new icon libraries.
Preserve Transovo brand name and terminology where shown in current Transovo captures.
Do NOT copy competitor trademarks, logos, or proprietary copy.

Return JSON only:
{
  "summary": "...",
  "files": [
    { "path": "page.tsx", "content": "..." },
    { "path": "components/ConversationList.tsx", "content": "..." },
    { "path": "mock-data.ts", "content": "..." },
    { "path": "reference.css", "content": "..." }
  ],
  "mockDataFiles": ["mock-data.ts"],
  "notes": ["..."],
  "backendAssumptions": ["..."]
}

Required files at minimum: page.tsx (default export ReferencePage), mock-data.ts, reference.css.
Implement modals, dropdowns, tabs, responsive layouts, hover/selected states when visible in reference.`;

export async function buildReferenceImplementation(
  provider: UiVisionProvider,
  input: {
    sessionId: string;
    target: string;
    manifest: ProjectManifest;
    referenceMedia: LabeledMedia[];
    currentMedia: LabeledMedia[];
    instruction: string;
    feedback?: string;
  },
): Promise<ReferenceBuildResult> {
  const designContext = designContextForKimi(input.manifest);

  const result = await provider.analyze({
    systemPrompt: REFERENCE_BUILD_SYSTEM,
    userPrompt: `BUILD VISUAL REFERENCE IMPLEMENTATION

TARGET PRODUCTION ROUTE (for context only — do NOT edit production): ${input.target}

USER INSTRUCTION:
${input.instruction || "(none)"}

${DESIGN_REFERENCE_DEFAULT_INSTRUCTION}

${input.feedback ? `REFINEMENT FEEDBACK:\n${input.feedback}\n` : ""}

TRANSOVO DESIGN / FRONTEND CONTEXT (brand + primitives — no backend):
${designContext}

Labelled media:
- REFERENCE_* = competitor/inspiration screenshots or videos
- CURRENT_TRANSOVO_* = what our page looks like today

Build the complete sandbox reference page under the file paths listed in the JSON schema.
Use mock data freely in mock-data.ts. Export ReferencePage from page.tsx.`,
    labeledMedia: [...input.referenceMedia, ...input.currentMedia],
    expectJson: true,
  });

  const parsed = (result.parsedJson || {}) as {
    summary?: string;
    files?: Array<{ path: string; content: string }>;
  };

  if (!parsed.files?.length) {
    throw new Error("Kimi did not return generated files — expected JSON with files[]");
  }

  const written = writeGeneratedFiles(input.sessionId, parsed.files);
  return { files: written, summary: parsed.summary || "Reference implementation generated" };
}
