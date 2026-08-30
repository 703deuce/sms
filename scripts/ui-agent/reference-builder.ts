import { MINIMAL_UI_STACK_CONTEXT } from "./config";
import { INCREMENTAL_FILE_PROTOCOL } from "./kimi-incremental-files";
import { listGeneratedFiles, readAllGeneratedSources, writeGeneratedFiles } from "./generated-sandbox";
import type { LabeledMedia, ProjectManifest, UiVisionProvider } from "./types";

export type ReferenceBuildResult = {
  files: string[];
  summary: string;
};

const REFERENCE_BUILD_SYSTEM = `You are a visual UI builder. Recreate the reference video/screenshot as runnable React/TSX in a sandbox.
Do NOT scaffold a new Next.js project. Generate ONLY: page.tsx, components/**, mock-data.ts, reference.css.
Start emitting code files quickly — do not over-plan in prose.

${INCREMENTAL_FILE_PROTOCOL}

Match layout, spacing, interactions, modals, and states visible in the reference.`;

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
      : `GENERATE THIS UI

TARGET PAGE (context only — sandbox, not production): ${input.target}

INSTRUCTION:
${input.instruction || "Recreate the reference UI faithfully."}

${MINIMAL_UI_STACK_CONTEXT}

${input.feedback ? `REFINEMENT FEEDBACK:\n${input.feedback}\n` : ""}

MEDIA:
- REFERENCE_* = inspiration video/screenshots — study layout and interactions
- CURRENT_TRANSOVO_* = our page today (brand shell reference)

Watch the reference video. Then emit sandbox files incrementally with KIMI_FILE_BEGIN/END.`,
    labeledMedia: isRevision
      ? input.currentMedia
      : [...input.referenceMedia, ...input.currentMedia],
    expectJson: false,
    useIncrementalFiles: true,
    skipReferenceVideo: isRevision,
    leanPrompt: !isRevision,
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
