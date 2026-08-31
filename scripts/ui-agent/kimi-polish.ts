import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyAcceptedChanges } from "./apply-plan";
import { captureCurrentSite } from "./capture-current";
import { captureWalkthrough } from "./capture-walkthrough";
import { REPO_ROOT, UI_AGENT_DIR } from "./config";
import { buildLabeledMedia } from "./reference-media";
import { createPolishCheckpoint, readGitDirtyFiles } from "./git-safety";
import { KIMI_POLISH_FILE_PROTOCOL, KimiPolishFileWriter } from "./kimi-polish-files";
import { designContextForKimi, buildProjectManifest, manifestToPromptContext } from "./project-context";
import { resolvePolishTarget } from "./polish-targets";
import { log, logError } from "./logger";
import { initProgress, markProgressReady, markProgressError, updateProgress } from "./progress";
import { validateTouchedFiles } from "./validate-changes";
import { createSessionId, saveSession, sessionDir, updateSession } from "./session";
import type { CliOptions, LabeledMedia, UiAgentSession, UiVisionProvider } from "./types";

export const KIMI_POLISH_SYSTEM = `You are polishing an existing production SaaS interface.

The screenshots show the CURRENT rendered Transovo page.
The attached source files are the REAL frontend implementation.

Do NOT rebuild the page from scratch.
Do NOT create a parallel sandbox or mock-only prototype.
Keep the current information architecture and functionality unless a visual change clearly improves usability.

Improve the existing frontend so it feels like a polished, mature SaaS platform rather than a basic admin interface.

Pay close attention to:
- color hierarchy and contrast
- typography scale and weight
- spacing rhythm
- surface/background separation
- cards, borders, shadows, radii
- table/list density
- button hierarchy (primary vs secondary vs ghost)
- selected/hover/focus states
- empty states and status pills
- icon consistency
- modal/drawer polish
- subtle transitions
- overall visual cohesion

Do not overdecorate. Do not turn everything into cards. Do not add giant hero headings or excessive empty space.
Preserve hooks, handlers, data fetching, and API calls exactly as they are.

${KIMI_POLISH_FILE_PROTOCOL}`;

function shouldUseDevBypass(): boolean {
  const raw = process.env.UI_AGENT_DEV_BYPASS?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  const dev = process.env.DEV_AUTH_BYPASS?.trim().toLowerCase();
  return dev === "1" || dev === "true" || dev === "yes";
}

function readSourceBundle(manifest: ReturnType<typeof buildProjectManifest>): string {
  const chunks: string[] = [];
  for (const file of manifest.targetFiles) {
    const abs = join(REPO_ROOT, file);
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, "utf8");
    const trimmed = source.length > 12000 ? `${source.slice(0, 12000)}\n/* ... truncated ... */` : source;
    chunks.push(`--- ${file} ---\n${trimmed}`);
  }
  return chunks.join("\n\n");
}

async function captureBefore(
  options: CliOptions,
  session: UiAgentSession,
  phase: "before" | "after",
): Promise<LabeledMedia[]> {
  const dir = join(sessionDir(session.id), phase === "before" ? "before" : "after");
  mkdirSync(dir, { recursive: true });

  const email = process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL;
  const password = process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD;
  const useDevBypass = shouldUseDevBypass();

  let paths: string[] = [];
  const target = resolvePolishTarget(session.target);

  if (options.walkthrough && target) {
    paths = await captureWalkthrough({
      baseUrl: options.baseUrl,
      outputDir: dir,
      steps: target.steps,
      viewports: ["desktop"],
      email,
      password,
      useDevBypass,
    });
  } else {
    paths = await captureCurrentSite({
      baseUrl: options.baseUrl,
      targetPath: session.target,
      outputDir: dir,
      viewports: options.viewports,
      screenshots: true,
      video: options.captureVideo,
      email,
      password,
      useDevBypass,
    });
  }

  session.currentMedia = paths.map((p) => ({
    label: p.split("/").pop() || p,
    path: p,
    viewport: "desktop",
  }));
  updateSession(session);

  return buildLabeledMedia(
    paths.map((p, i) => ({
      path: p,
      label: `${phase === "before" ? "BEFORE" : "AFTER"}_TRANSOVO_${i + 1}`,
      purpose: `${phase === "before" ? "Current" : "Updated"} Transovo rendered page`,
    })),
  );
}

async function runPolishPass(
  provider: UiVisionProvider,
  options: CliOptions,
  session: UiAgentSession,
  pass: number,
  beforeMedia: LabeledMedia[],
  referenceMedia: LabeledMedia[],
  reviewMedia?: LabeledMedia[],
): Promise<string[]> {
  const manifest = session.manifest;
  const sourceBundle = readSourceBundle(manifest);
  const isReview = Boolean(reviewMedia?.length);

  const userPrompt = isReview
    ? `VISUAL REVIEW PASS ${pass}

TARGET: ${session.target}
INSTRUCTION: ${options.instruction || "Identify only meaningful remaining visual problems and fix them."}

Compare BEFORE vs AFTER screenshots. Did the polish actually improve visual quality?
Emit only files that still need adjustment.

CURRENT SOURCE:
${sourceBundle}`
    : `POLISH PASS ${pass}

TARGET ROUTE: ${session.target}
INSTRUCTION:
${options.instruction || "Tighten visual quality without changing structure or functionality."}

FRONTEND CONTEXT:
${designContextForKimi(manifest)}

MANIFEST:
${manifestToPromptContext(manifest)}

CURRENT IMPLEMENTATION:
${sourceBundle}

MEDIA:
- BEFORE_* screenshots = current rendered page (all states)
- REFERENCE_* = optional quality reference only — do not rebuild it

Apply presentation-layer improvements directly to the real files listed above.`;

  const writer = new KimiPolishFileWriter(session.id);
  const result = await provider.analyze({
    systemPrompt: KIMI_POLISH_SYSTEM,
    userPrompt,
    labeledMedia: [...beforeMedia, ...referenceMedia, ...(reviewMedia || [])],
    expectJson: false,
    useIncrementalFiles: false,
    reasoningEffort: options.reasoningEffort || "low",
    leanPrompt: true,
    sessionId: session.id,
    phaseLabel: isReview ? `Kimi polish review ${pass}` : `Kimi polish ${pass}`,
  });

  writer.feed(result.rawText);
  const { accepted, rejected } = writer.flush();

  if (rejected.length) {
    log("polish rejected paths", rejected.map((r) => `${r.path}: ${r.reason}`).join("; "));
  }

  if (!options.apply) {
    log("polish plan-only", `${accepted.length} file(s) proposed — re-run with --apply`);
    writeFileSync(
      join(sessionDir(session.id), `polish-pass-${pass}-plan.json`),
      JSON.stringify({ accepted, rejected }, null, 2),
    );
    return accepted.map((c) => c.file);
  }

  if (accepted.length === 0) {
    throw new Error("Kimi polish returned no applicable file changes");
  }

  const touched = applyAcceptedChanges(accepted, false);
  const validation = validateTouchedFiles(touched);
  if (!validation.ok) {
    throw new Error(`Polish validation failed: ${validation.protectedViolations.join(", ") || validation.lint}`);
  }

  return touched;
}

export async function runKimiPolishCommand(
  provider: UiVisionProvider,
  options: CliOptions,
): Promise<{ sessionId: string; target: string; touchedFiles: string[] }> {
  if (!options.target) throw new Error("--target is required for polish mode");

  const manifest = buildProjectManifest(options.target);
  const session: UiAgentSession = {
    id: createSessionId(),
    createdAt: new Date().toISOString(),
    target: options.target,
    instruction: options.instruction || "",
    referenceMedia: [],
    currentMedia: [],
    manifest,
    status: "generating",
  };
  saveSession(session);
  initProgress(session.id, `Kimi polish: ${session.target}`);

  const checkpoint = createPolishCheckpoint(session.id);
  log("git checkpoint", `BEFORE_KIMI_POLISH=${checkpoint.commitHash}`);

  try {
    updateProgress(session.id, { phase: "capture_before", message: "Capturing current page states…" });
    const beforeMedia = await captureBefore(options, session, "before");

    let referenceMedia: LabeledMedia[] = [];
    if (options.referenceVideoNames.length || options.referenceImageNames.length) {
      const { resolveAllReferenceMediaForKimi } = await import("./reference-resolve");
      referenceMedia = await resolveAllReferenceMediaForKimi({
        videoNames: options.referenceVideoNames,
        imageNames: options.referenceImageNames,
        videoFiles: options.referenceVideos,
        imageFiles: options.referenceImages,
        legacyNames: options.referenceNames,
      });
    }

    const maxPasses = Math.min(options.maxPasses, 2);
    let allTouched: string[] = [];

    for (let pass = 1; pass <= maxPasses; pass++) {
      updateProgress(session.id, {
        phase: "polishing",
        message: `Kimi polish pass ${pass}/${maxPasses}…`,
      });

      const touched = await runPolishPass(
        provider,
        options,
        session,
        pass,
        beforeMedia,
        referenceMedia,
        pass > 1 ? await captureBefore(options, session, "after") : undefined,
      );
      allTouched = [...new Set([...allTouched, ...touched])];

      if (options.apply && pass < maxPasses) {
        updateProgress(session.id, { phase: "capture_after", message: "Capturing after state for review…" });
        await captureBefore({ ...options, walkthrough: options.walkthrough }, session, "after");
      }
    }

    if (options.apply) {
      updateProgress(session.id, { phase: "capture_after", message: "Final after screenshots…" });
      await captureBefore(options, session, "after");
    }

    session.status = "ready";
    updateSession(session);

    writeFileSync(
      join(sessionDir(session.id), "polish-summary.json"),
      JSON.stringify(
        {
          sessionId: session.id,
          target: session.target,
          checkpoint: checkpoint.commitHash,
          touchedFiles: allTouched,
          dirtyBefore: checkpoint.dirtyBefore,
          applied: options.apply,
          walkthrough: options.walkthrough,
        },
        null,
        2,
      ),
    );

    markProgressReady(session.id, `Polish complete — ${allTouched.length} file(s) ${options.apply ? "updated" : "proposed"}`);
    console.log("");
    console.log("KIMI_POLISH_READY");
    console.log(`session=${session.id}`);
    console.log(`target=${session.target}`);
    console.log(`BEFORE_KIMI_POLISH=${checkpoint.commitHash}`);
    console.log(`files=${allTouched.length}`);
    console.log(`applied=${options.apply}`);
    console.log(`rollback=git checkout ${checkpoint.commitHash} -- ${allTouched.join(" ") || "."}`);
    console.log("");

    return { sessionId: session.id, target: session.target, touchedFiles: allTouched };
  } catch (err) {
    session.status = "error";
    updateSession(session);
    const message = err instanceof Error ? err.message : String(err);
    markProgressError(session.id, message);
    logError("polish failed", message);
    throw err;
  }
}
