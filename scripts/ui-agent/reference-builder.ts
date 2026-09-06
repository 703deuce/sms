import { KIMI_COMPLETENESS_REQUIREMENTS, MINIMAL_UI_STACK_CONTEXT } from "./config";
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

${KIMI_COMPLETENESS_REQUIREMENTS}

${INCREMENTAL_FILE_PROTOCOL}

Match layout, spacing, interactions, modals, and states visible in the reference.`;

const COMPLETENESS_SYSTEM = `You complete a PARTIAL Kimi sandbox UI. The reference video was already used for an initial pass but screens are missing.
Generate ONLY the missing views/components and update page.tsx wiring. Preserve existing files unless they must change to wire new views.

${KIMI_COMPLETENESS_REQUIREMENTS}

${INCREMENTAL_FILE_PROTOCOL}

Re-watch the reference video focusing on builder canvases, wizards, modals, and secondary pages not yet in the sandbox.`;

const REVISE_SYSTEM = `Revise the Kimi sandbox UI only. Do not touch production.
The reference video was already analyzed in the initial build — do NOT require re-watching it.
Use the existing generated files as the source of truth.

${INCREMENTAL_FILE_PROTOCOL}

Emit only files that changed, or the full set if easier. Use KIMI_FILE_BEGIN/END for each file.`;

const COMPLETION_SYSTEM = `You complete an EXISTING Kimi sandbox UI to implementation-ready blueprint quality.
This is a surgical gap-fill repass — NOT first-pass generation and NOT production integration.

WORK HIERARCHY: Preserve → Complete → Correct → Polish (in that order).

RULES:
- Study CURRENT_RENDERED_DRAFT screenshot AND existing code as the baseline.
- Perform a fresh requirement comparison against Page Contract, atomic features, and standards.
- Audit gap hints are non-exhaustive — add anything else the spec requires.
- Add missing UI; wire or remove dead ends; minimal polish only after requirements are met.
- Stop when the stopping condition in the instruction is met — do not redesign for variation.
- Do NOT full-regenerate unless the baseline is unusable.
- Do NOT touch production routes or backend logic.
- Do NOT grade or accept your own work.

${INCREMENTAL_FILE_PROTOCOL}

Emit updated files using KIMI_FILE_BEGIN/END. Update existing components in place when possible.`;

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
    isCompletenessPass?: boolean;
    isCompletionPass?: boolean;
    referenceNames?: string[];
  },
): Promise<ReferenceBuildResult> {
  const isRevision = Boolean(input.isRevision);
  const isCompletenessPass = Boolean(input.isCompletenessPass);
  const isCompletionPass = Boolean(input.isCompletionPass);

  const result = await provider.analyze({
    systemPrompt: isCompletionPass
      ? COMPLETION_SYSTEM
      : isCompletenessPass
      ? COMPLETENESS_SYSTEM
      : isRevision
        ? REVISE_SYSTEM
        : REFERENCE_BUILD_SYSTEM,
    userPrompt: isCompletionPass
      ? `MODE 4 COMPLETION & POLISH — GAP-FILL REPASS

TARGET ROUTE: ${input.target}
INSTRUCTION:
${input.instruction || "Complete the UI blueprint for this surface."}

CURRENT_RENDERED_DRAFT screenshot (if attached) shows what renders today.
EXISTING SANDBOX FILES (baseline — extend and improve, do not discard):
${formatExistingSources(input.sessionId)}

Work hierarchy: Preserve → Complete → Correct → Polish.
Perform fresh requirement comparison. Audit gaps are hints only.
Stop at the stopping condition — do not redesign for taste.
Emit updated files using KIMI_FILE_BEGIN/END.`
      : isCompletenessPass
      ? `COMPLETENESS PASS — MISSING UI

TARGET ROUTE: ${input.target}
INSTRUCTION:
${input.instruction || "Generate all missing screens from the reference video."}

EXISTING SANDBOX FILES (extend — do not discard):
${formatExistingSources(input.sessionId)}

Watch the reference video. Emit missing files and updated wiring using KIMI_FILE_BEGIN/END.`
      : isRevision
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
    labeledMedia: isCompletionPass
      ? [...input.referenceMedia, ...input.currentMedia]
      : isRevision && !isCompletenessPass
      ? input.currentMedia
      : [...input.referenceMedia, ...input.currentMedia],
    expectJson: false,
    useIncrementalFiles: true,
    skipReferenceVideo: (isRevision || isCompletionPass) && !isCompletenessPass,
    leanPrompt: !isRevision && !isCompletenessPass && !isCompletionPass,
    sessionId: input.sessionId,
    phaseLabel: isCompletionPass
      ? "Kimi Mode 4 completion"
      : input.feedback
        ? "Kimi refinement"
        : "Kimi initial build",
    draftTargetRoute: input.target,
    referenceNames: input.referenceNames,
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
