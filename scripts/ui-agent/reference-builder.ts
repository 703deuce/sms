import { DESIGN_REFERENCE_DEFAULT_INSTRUCTION } from "./config";
import { INCREMENTAL_FILE_PROTOCOL } from "./kimi-incremental-files";
import { listGeneratedFiles, readAllGeneratedSources, writeGeneratedFiles } from "./generated-sandbox";
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

${INCREMENTAL_FILE_PROTOCOL}

Implement modals, dropdowns, tabs, responsive layouts, hover/selected states when visible in reference.`;

const REVISE_SYSTEM = `Revise the Kimi sandbox UI only. Do not touch production.
The reference video was already analyzed in the initial build — do NOT require re-watching it.
Use the existing generated files as the source of truth.

${INCREMENTAL_FILE_PROTOCOL}

Emit only files that changed, or the full set if easier. Use KIMI_FILE_BEGIN/END for each file.`;

function formatExistingSources(sessionId: string): string {
  const sources = readAllGeneratedSources(sessionId);
  if (sources.length === 0) return "(no existing sandbox files)";
  return sources.map((s) => `--- ${s.path} ---\n${s.content}`).join("\n\n");
}

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
    isRevision?: boolean;
  },
): Promise<ReferenceBuildResult> {
  const designContext = designContextForKimi(input.manifest);
  const isRevision = Boolean(input.isRevision);

  const result = await provider.analyze({
    systemPrompt: isRevision ? REVISE_SYSTEM : REFERENCE_BUILD_SYSTEM,
    userPrompt: isRevision
      ? `REVISE GENERATED REFERENCE

TARGET ROUTE: ${input.target}
INSTRUCTION: ${input.instruction || "(none)"}

The reference video was already analyzed — revise the EXISTING sandbox code below.
Do not re-plan from scratch unless the instruction requires it.

EXISTING SANDBOX FILES:
${formatExistingSources(input.sessionId)}

Apply the instruction. Emit updated files using KIMI_FILE_BEGIN/END.`
      : `BUILD VISUAL REFERENCE IMPLEMENTATION

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

Build the complete sandbox reference page. Use mock data in mock-data.ts. Export ReferencePage from page.tsx.
Emit files incrementally with KIMI_FILE_BEGIN/END — do not buffer one giant JSON object.`,
    labeledMedia: isRevision
      ? input.currentMedia
      : [...input.referenceMedia, ...input.currentMedia],
    expectJson: false,
    useIncrementalFiles: true,
    skipReferenceVideo: isRevision,
    sessionId: input.sessionId,
    phaseLabel: input.feedback ? "Kimi refinement" : "Kimi initial build",
  });

  const incrementalFiles = listGeneratedFiles(input.sessionId).filter(
    (f) => f !== "metadata.json" && !f.endsWith("APPROVED.json"),
  );

  if (incrementalFiles.length > 0) {
    return {
      files: incrementalFiles,
      summary: `Incremental build: ${incrementalFiles.length} file(s) materialized during stream`,
    };
  }

  const parsed = (result.parsedJson || {}) as {
    summary?: string;
    files?: Array<{ path: string; content: string }>;
  };

  if (parsed.files?.length) {
    const written = writeGeneratedFiles(input.sessionId, parsed.files);
    return { files: written, summary: parsed.summary || "Reference implementation generated" };
  }

  throw new Error("Kimi did not return generated files — expected KIMI_FILE_BEGIN/END blocks or JSON files[]");
}
