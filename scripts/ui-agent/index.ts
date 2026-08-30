import { applyAcceptedChanges } from "./apply-plan";
import { parseCliArgs, printUsage } from "./cli";
import { captureCurrentSite, captureReferenceUrl } from "./capture-current";
import { validateImplementationPlan, writePlanReport } from "./change-plan";
import { ensureUiAgentDirs, resolveUiAgentPath } from "./config";
import { filesChangedOutsidePlan, readGitDirtyFiles, restoreSnapshots, snapshotFiles } from "./git-safety";
import { KimiVisionProvider } from "./kimi-client";
import { log, logError } from "./logger";
import { buildProjectManifest } from "./project-context";
import { buildLabeledMedia, loadNamedReference } from "./reference-media";
import { createSessionId, loadSession, saveSession, sessionDir, updateSession } from "./session";
import type { CliOptions, LabeledMedia, UiAgentSession } from "./types";
import {
  analyzeReferenceMedia,
  buildDifferencePlan,
  generateImplementationPlan,
} from "./visual-analysis";
import { validateTouchedFiles } from "./validate-changes";

async function collectReferenceMedia(options: CliOptions, sessionDirPath: string): Promise<LabeledMedia[]> {
  const labeled: Array<{ path: string; label: string; purpose: string }> = [];

  for (const name of options.referenceNames) {
    const named = loadNamedReference(name);
    options.referenceImages.push(...named.images);
    options.referenceVideos.push(...named.videos);
  }

  for (let i = 0; i < options.referenceUrls.length; i++) {
    const url = options.referenceUrls[i];
    const out = join(sessionDirPath, "references", `url-${i + 1}`);
    const captured = await captureReferenceUrl({
      url,
      outputDir: out,
      depth: options.referenceDepth,
      screenshots: true,
      video: options.captureVideo,
    });
    for (const file of captured) {
      labeled.push({ path: file, label: `REFERENCE_URL_${i + 1}`, purpose: `Captured from ${url}` });
    }
  }

  options.referenceImages.forEach((p, idx) => {
    labeled.push({ path: resolveUiAgentPath(p), label: `REFERENCE_IMAGE_${idx + 1}`, purpose: "User-supplied reference image" });
  });
  options.referenceVideos.forEach((p, idx) => {
    labeled.push({ path: resolveUiAgentPath(p), label: `REFERENCE_VIDEO_${idx + 1}`, purpose: "User-supplied reference video" });
  });

  return buildLabeledMedia(labeled);
}

async function collectCurrentMedia(options: CliOptions, session: UiAgentSession): Promise<LabeledMedia[]> {
  const dir = join(sessionDir(session.id), "current");
  mkdirSync(dir, { recursive: true });

  if (options.captureCurrent && session.target) {
    const captured = await captureCurrentSite({
      baseUrl: options.baseUrl,
      targetPath: session.target,
      outputDir: dir,
      viewports: options.viewports,
      screenshots: options.captureScreenshots,
      video: options.captureVideo,
      email: process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL,
      password: process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD,
    });
    session.currentMedia = captured.map((p) => ({ label: basename(p), path: p }));
    updateSession(session);
  }

  const labeled: Array<{ path: string; label: string; purpose: string }> = [];
  for (const manual of options.currentImages) {
    labeled.push({ path: resolveUiAgentPath(manual), label: "CURRENT_TRANSOVO_IMAGE", purpose: "Manual current-site screenshot" });
  }
  for (const manual of options.currentVideos) {
    labeled.push({ path: resolveUiAgentPath(manual), label: "CURRENT_TRANSOVO_VIDEO", purpose: "Manual current-site video" });
  }
  for (const item of session.currentMedia) {
    labeled.push({ path: item.path, label: `CURRENT_TRANSOVO_${item.viewport || basename(item.path)}`, purpose: "Current Transovo rendered page" });
  }

  return buildLabeledMedia(labeled);
}

async function runAnalyze(options: CliOptions): Promise<void> {
  if (!options.target) throw new Error("--target is required");
  ensureUiAgentDirs();
  const provider = await KimiVisionProvider.createValidated();
  const sessionId = createSessionId();
  const manifest = buildProjectManifest(options.target);
  const session: UiAgentSession = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    target: options.target,
    instruction: options.instruction || "",
    referenceMedia: [],
    currentMedia: [],
    manifest,
  };
  saveSession(session);

  log("resolving target route", options.target);
  log("collecting existing implementation", `${manifest.targetFiles.length} files`);

  const referenceMedia = await collectReferenceMedia(options, sessionDir(session.id));
  if (referenceMedia.length === 0) throw new Error("Provide --reference-image, --reference-video, or --reference-url");

  log("capturing current UI", options.captureCurrent ? "automatic" : "manual/supplied");
  const currentMedia = await collectCurrentMedia(options, session);

  log("analyzing reference media", `${referenceMedia.length} item(s)`);
  const referenceAnalysis = await analyzeReferenceMedia(provider, referenceMedia, options.instruction || "");
  session.referenceAnalysis = referenceAnalysis;
  updateSession(session);

  log("comparing reference against current implementation");
  const differencePlan = await buildDifferencePlan(provider, {
    referenceAnalysis,
    currentMedia,
    manifest,
    instruction: options.instruction || "",
  });
  session.differencePlan = differencePlan;
  updateSession(session);

  const report = writePlanReport({
    sessionId: session.id,
    target: session.target,
    referenceFiles: referenceMedia.map((m) => m.path),
    inspectedFiles: manifest.targetFiles,
    differencePlan,
  });

  log("complete", `session=${session.id} report=${report}`);
}

async function runImprove(options: CliOptions): Promise<void> {
  ensureUiAgentDirs();
  const provider = await KimiVisionProvider.createValidated();

  let session: UiAgentSession;
  if (options.sessionId) {
    session = loadSession(options.sessionId);
    log("resuming session", session.id);
  } else {
    if (!options.target) throw new Error("--target is required for a new session");
    const manifest = buildProjectManifest(options.target);
    session = {
      id: createSessionId(),
      createdAt: new Date().toISOString(),
      target: options.target,
      instruction: options.instruction || "",
      referenceMedia: [],
      currentMedia: [],
      manifest,
    };
    saveSession(session);
    log("resolving target route", options.target);
    log("collecting existing implementation", `${manifest.targetFiles.length} files`);

    const referenceMedia = await collectReferenceMedia(options, sessionDir(session.id));
    if (referenceMedia.length === 0) throw new Error("Provide reference media");
    log("capturing current UI");
    const currentMedia = await collectCurrentMedia(options, session);
    log("analyzing reference media", `${referenceMedia.length} item(s)`);
    session.referenceAnalysis = await analyzeReferenceMedia(provider, referenceMedia, options.instruction || "");
    session.differencePlan = await buildDifferencePlan(provider, {
      referenceAnalysis: session.referenceAnalysis,
      currentMedia,
      manifest,
      instruction: options.instruction || "",
    });
    updateSession(session);
  }

  if (!session.differencePlan) throw new Error("Session missing difference plan — run analyze first");

  log("generating safe change plan");
  const implementationPlan = await generateImplementationPlan(provider, {
    differencePlan: session.differencePlan,
    manifest: session.manifest,
    instruction: session.instruction,
  });
  session.implementationPlan = implementationPlan;
  updateSession(session);

  const { accepted, rejected } = validateImplementationPlan(implementationPlan);
  const report = writePlanReport({
    sessionId: session.id,
    target: session.target,
    referenceFiles: session.referenceMedia.map((m) => m.path),
    inspectedFiles: session.manifest.targetFiles,
    differencePlan: session.differencePlan,
    implementationPlan,
    rejectedChanges: rejected,
  });

  log("plan ready", `${accepted.length} accepted, ${rejected.length} rejected — ${report}`);

  if (options.planOnly && !options.apply) {
    log("complete", "plan-only mode — no files modified");
    return;
  }

  if (accepted.length === 0) {
    logError("apply aborted", "no accepted file changes");
    return;
  }

  const dirtyBefore = readGitDirtyFiles();
  const snapshots = snapshotFiles(accepted.map((c) => c.file));
  log("applying UI changes", options.dryRun ? "dry-run" : `${accepted.length} file(s)`);
  const touched = applyAcceptedChanges(accepted, options.dryRun);

  const outsiders = filesChangedOutsidePlan(dirtyBefore, touched);
  if (outsiders.length > 0) {
    logError("dirty tree conflict", outsiders.join(", "));
  }

  if (!options.dryRun) {
    log("validating protected backend files");
    const validation = validateTouchedFiles(touched);
    if (!validation.ok || validation.protectedViolations.length > 0) {
      logError("validation failed — rolling back", validation.protectedViolations.join(", "));
      restoreSnapshots(snapshots.snapshots);
      return;
    }
    log("running frontend checks");
  }

  log("complete", `session=${session.id}`);
}

async function runCapture(options: CliOptions): Promise<void> {
  if (!options.target && !options.referenceUrls[0]) throw new Error("--target or --reference-url required");
  ensureUiAgentDirs();
  const sessionId = createSessionId();
  const dir = sessionDir(sessionId);
  mkdirSync(dir, { recursive: true });

  if (options.target) {
    await captureCurrentSite({
      baseUrl: options.baseUrl,
      targetPath: options.target,
      outputDir: join(dir, "current"),
      viewports: options.viewports,
      screenshots: options.captureScreenshots,
      video: options.captureVideo,
      email: process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL,
      password: process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD,
    });
  }

  for (const url of options.referenceUrls) {
    await captureReferenceUrl({
      url,
      outputDir: join(dir, "references"),
      depth: options.referenceDepth,
      screenshots: options.captureScreenshots,
      video: options.captureVideo,
    });
  }

  log("capture complete", `session=${sessionId}`);
}

async function runValidate(options: CliOptions): Promise<void> {
  if (!options.sessionId) throw new Error("--session is required");
  const session = loadSession(options.sessionId);
  if (!session.implementationPlan) throw new Error("Session has no implementation plan");
  const touched = session.implementationPlan.changes.map((c) => c.file);
  const result = validateTouchedFiles(touched);
  log("validation", JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const options = parseCliArgs(process.argv);

  if (!command || command === "help" || process.argv.includes("--help")) {
    printUsage();
    return;
  }

  switch (command) {
    case "analyze":
      await runAnalyze(options);
      break;
    case "improve":
      await runImprove(options);
      break;
    case "capture":
      await runCapture(options);
      break;
    case "validate":
      await runValidate(options);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  logError("failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
