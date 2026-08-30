import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildReferenceImplementation } from "./reference-builder";
import { refineReferenceImplementation, screenshotGeneratedReference } from "./refine-reference";
import { buildProjectManifest } from "./project-context";
import {
  buildEnvironmentManifest,
  environmentManifestToPrompt,
  writeEnvironmentManifest,
  writeSessionInput,
} from "./environment-manifest";
import { resolveAllReferenceMediaForKimi } from "./reference-resolve";
import { auditSandboxCompleteness, printCompletenessReport } from "./kimi-completeness";
import { writeHandoff } from "./handoff";
import { buildLabeledMedia } from "./reference-media";
import { captureCurrentSite } from "./capture-current";
import { KIMI_UI_REFERENCES_PATH, kimiUiPreviewPath } from "./config";
import {
  generatedDirForSession,
  listGeneratedFiles,
  readAllGeneratedSources,
  writeGeneratedFiles,
} from "./generated-sandbox";
import { assertKimiOutputPersisted, persistKimiGeneratedSource } from "./kimi-persist";
import { log } from "./logger";
import { initProgress, markProgressError, markProgressReady, progressTailPath, updateProgress } from "./progress";
import { startKimiTiming, markKimiTiming, printKimiTimingReport } from "./kimi-timing";
import { createSessionId, loadSession, saveSession, sessionDir, updateSession } from "./session";
import type { CliOptions, LabeledMedia, UiAgentSession, UiVisionProvider } from "./types";

function finishKimiSession(
  session: UiAgentSession,
  referenceVideoNames: string[],
  build: { summary?: string; files: { path: string }[] },
): { sessionId: string; target: string; fileCount: number } {
  persistKimiGeneratedSource({
    sessionId: session.id,
    targetRoute: session.target,
    referenceNames: referenceVideoNames,
    status: "generated",
  });
  assertKimiOutputPersisted(session.id, session.target);
  printKimiReady(session, build.summary, build.files.length);
  return { sessionId: session.id, target: session.target, fileCount: build.files.length };
}

function sessionReferenceVideoNames(sessionId: string): string[] {
  const inputPath = join(sessionDir(sessionId), "input.json");
  if (existsSync(inputPath)) {
    const input = JSON.parse(readFileSync(inputPath, "utf8")) as { referenceVideoNames?: string[] };
    if (input.referenceVideoNames?.length) return input.referenceVideoNames;
  }
  return [];
}

async function collectCurrentMediaForKimi(
  options: CliOptions,
  session: UiAgentSession,
): Promise<LabeledMedia[]> {
  const sessionDirPath = join(sessionDir(session.id), "current");
  const labeled: Array<{ path: string; label: string; purpose: string }> = [];

  if (options.captureCurrent && session.target) {
    const captured = await captureCurrentSite({
      baseUrl: options.baseUrl,
      targetPath: session.target,
      outputDir: sessionDirPath,
      viewports: options.viewports,
      screenshots: options.captureScreenshots,
      video: options.captureVideo,
      email: process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL,
      password: process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD,
    });
    session.currentMedia = captured.map((p) => ({ label: p.split("/").pop() || p, path: p }));
    updateSession(session);
  }

  for (const item of session.currentMedia) {
    labeled.push({
      path: item.path,
      label: `CURRENT_TRANSOVO_${item.viewport || item.label}`,
      purpose: "Current Transovo rendered page",
    });
  }

  return buildLabeledMedia(labeled);
}

export async function runKimiCommand(
  provider: UiVisionProvider,
  options: CliOptions,
): Promise<{ sessionId: string; target: string; fileCount: number }> {
  let session: UiAgentSession;

  if (options.sessionId && options.complete) {
    session = loadSession(options.sessionId);
    session.status = "generating";
    updateSession(session);

    const report = auditSandboxCompleteness(session.id, session.target);
    printCompletenessReport(report);

    const referenceVideoNames = sessionReferenceVideoNames(session.id);
    if (referenceVideoNames.length === 0) {
      throw new Error(`No referenceVideoNames in session input.json — cannot run completeness pass`);
    }
    const referenceMedia = await resolveAllReferenceMediaForKimi({
      videoNames: referenceVideoNames,
      imageNames: [],
      videoFiles: [],
      imageFiles: [],
      legacyNames: [],
    });

    const currentMedia = await collectCurrentMediaForKimi(options, session);
    const instruction =
      options.instruction?.trim() ||
      report.instruction ||
      "Generate all missing screens from the reference video.";

    log("Kimi completeness pass", session.id);
    startKimiTiming(session.id);
    const build = await buildReferenceImplementation(provider, {
      sessionId: session.id,
      target: session.target,
      manifest: session.manifest,
      referenceMedia,
      currentMedia,
      instruction,
      isCompletenessPass: true,
    });

    persistKimiGeneratedSource({
      sessionId: session.id,
      targetRoute: session.target,
      referenceNames: referenceVideoNames,
      status: "generated",
    });
    assertKimiOutputPersisted(session.id, session.target);

    await screenshotGeneratedReference(session.id);
    markKimiTiming(session.id, "previewRenderedMs");

    const after = auditSandboxCompleteness(session.id, session.target);
    printCompletenessReport(after);

    session.status = "ready";
    session.refinementPasses = (session.refinementPasses || 0) + 1;
    updateSession(session);
    writeHandoff(session);
    printKimiTimingReport(session.id);
    return finishKimiSession(session, referenceVideoNames, build);
  }

  if (options.sessionId && options.revise) {
    session = loadSession(options.sessionId);
    session.status = "generating";
    updateSession(session);

    const currentMedia = await collectCurrentMediaForKimi(options, session);

    log("revising Kimi sandbox (no video re-analysis)", options.instruction || "(no instruction)");
    startKimiTiming(session.id);
    const build = await buildReferenceImplementation(provider, {
      sessionId: session.id,
      target: session.target,
      manifest: session.manifest,
      referenceMedia: [],
      currentMedia,
      instruction: options.instruction || "",
      isRevision: true,
    });

    persistKimiGeneratedSource({
      sessionId: session.id,
      targetRoute: session.target,
      referenceNames: sessionReferenceVideoNames(session.id),
      status: "generated",
    });
    assertKimiOutputPersisted(session.id, session.target);

    await screenshotGeneratedReference(session.id);
    markKimiTiming(session.id, "previewRenderedMs");

    session.status = "ready";
    session.refinementPasses = (session.refinementPasses || 0) + 1;
    updateSession(session);
    writeHandoff(session);
    printKimiTimingReport(session.id);
    return finishKimiSession(session, sessionReferenceVideoNames(session.id), build);
  }

  if (!options.target) throw new Error("--target is required for ui:kimi");

  const manifest = buildProjectManifest(options.target);
  const envManifest = buildEnvironmentManifest(manifest);

  const referenceMedia = await resolveAllReferenceMediaForKimi({
    videoNames: options.referenceVideoNames,
    imageNames: options.referenceImageNames,
    videoFiles: options.referenceVideos,
    imageFiles: options.referenceImages,
    legacyNames: options.referenceNames,
  });

  if (referenceMedia.length === 0) {
    throw new Error("Provide --video, --image, --reference-video, or --reference-image");
  }

  const videoCount = referenceMedia.filter((m) => m.kind === "video").length;
  const imageCount = referenceMedia.filter((m) => m.kind === "image").length;

  session = {
    id: createSessionId(),
    createdAt: new Date().toISOString(),
    target: options.target,
    instruction: options.instruction || "",
    referenceMedia: [],
    currentMedia: [],
    manifest,
    generatedDir: generatedDirForSession(""),
    status: "generating",
  };
  session.generatedDir = generatedDirForSession(session.id);
  saveSession(session);

  initProgress(session.id, `Starting Kimi session for ${session.target}`);
  startKimiTiming(session.id);
  log("progress log", progressTailPath(session.id));

  try {
    writeEnvironmentManifest(session.id, envManifest);
    writeSessionInput(session.id, {
      target: options.target,
      instruction: options.instruction,
      referenceVideoNames: options.referenceVideoNames,
      referenceImageNames: options.referenceImageNames,
      captureCurrent: options.captureCurrent,
    });

    markKimiTiming(session.id, "referenceResolvedMs");
    updateProgress(session.id, {
      phase: "resolving_media",
      message: `Resolved ${videoCount} video(s) and ${imageCount} image(s). Preparing Kimi…`,
    });

    session.referenceMedia = referenceMedia.map((m) => ({
      label: m.label,
      purpose: m.purpose,
      path: m.path,
      source: m.supabase ? `supabase:${m.supabase.bucket}/${m.supabase.path}` : "resolved",
    }));
    updateSession(session);

    const currentMedia = await collectCurrentMediaForKimi(options, session);

    log("calling Kimi", session.id);
    log("watch progress", `tail -f ${progressTailPath(session.id)}`);
    const build = await buildReferenceImplementation(provider, {
      sessionId: session.id,
      target: session.target,
      manifest: session.manifest,
      referenceMedia,
      currentMedia,
      instruction: session.instruction,
    });

    // Persist immediately — refinement/preview failures must not lose generated source.
    persistKimiGeneratedSource({
      sessionId: session.id,
      targetRoute: session.target,
      referenceNames: options.referenceVideoNames,
      status: "generated",
    });
    assertKimiOutputPersisted(session.id, session.target);

    try {
      await screenshotGeneratedReference(session.id);
      markKimiTiming(session.id, "previewRenderedMs");
    } catch (err) {
      log("preview screenshot skipped", err instanceof Error ? err.message : String(err));
    }

    let passes = 0;
    while (passes < options.maxPasses) {
      passes += 1;
      updateProgress(session.id, {
        phase: "refining",
        message: `Visual refinement pass ${passes}/${options.maxPasses}…`,
      });
      log("visual refinement pass", `${passes}/${options.maxPasses}`);
      await refineReferenceImplementation(provider, {
        sessionId: session.id,
        target: session.target,
        manifest: session.manifest,
        referenceMedia,
        currentMedia,
        instruction: session.instruction,
        originalReferenceMedia: referenceMedia,
        pass: passes,
        maxPasses: options.maxPasses,
      });
    }

    session.refinementPasses = passes;
    session.status = "ready";
    updateSession(session);
    writeHandoff(session);
    markProgressReady(session.id, `Kimi sandbox ready (${listGeneratedFiles(session.id).length} files). Open preview to compare.`);
    printKimiTimingReport(session.id);

    const files = listGeneratedFiles(session.id);
    log("preview", kimiUiPreviewPath(session.id));
    log("approve", `npm run ui:approve -- --session ${session.id}`);
    log("draft", `src/kimi-drafts/${session.target.replace(/^\//, "").replace(/\//g, "-")}/${session.id}/`);
    return finishKimiSession(session, options.referenceVideoNames, build);
  } catch (error) {
    session.status = "error";
    updateSession(session);
    const message = error instanceof Error ? error.message : String(error);
    markProgressError(session.id, message);
    throw error;
  }
}

function printKimiReady(session: UiAgentSession, summary?: string, fileCount?: number): void {
  const generated = session.generatedDir || generatedDirForSession(session.id);
  const count = fileCount ?? listGeneratedFiles(session.id).length;
  console.log("");
  console.log("KIMI_UI_READY");
  console.log(`session=${session.id}`);
  console.log(`target=${session.target}`);
  console.log(`generated=${generated}`);
  console.log(`files=${count}`);
  if (summary) console.log(`summary=${summary}`);
  console.log(`preview=${kimiUiPreviewPath(session.id)}`);
  console.log(`progress=tail -f .ui-agent/sessions/${session.id}/progress.log`);
  console.log(`stream=tail -f .ui-agent/sessions/${session.id}/kimi-stream.log`);
  console.log(`live=tail -f .ui-agent/sessions/${session.id}/kimi-live.txt`);
  console.log(`upload=${KIMI_UI_REFERENCES_PATH}`);
  console.log("");
}
