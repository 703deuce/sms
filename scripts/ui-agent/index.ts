import { basename, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { applyAcceptedChanges } from "./apply-plan";
import { approveReference } from "./approve-reference";
import { parseCliArgs, printUsage } from "./cli";
import { captureCurrentSite, captureReferenceUrl } from "./capture-current";
import { validateImplementationPlan } from "./change-plan";
import { ensureUiAgentDirs, resolveUiAgentPath, UI_AGENT_REFERENCES_DIR } from "./config";
import { generatedDirForSession } from "./generated-sandbox";
import { filesChangedOutsidePlan, readGitDirtyFiles, restoreSnapshots, snapshotFiles } from "./git-safety";
import {
  generateFunctionalMappingReport,
  generateIntegrationPlan,
  writeIntegrationReport,
} from "./integrate";
import { KimiVisionProvider } from "./kimi-client";
import { log, logError } from "./logger";
import { buildProjectManifest } from "./project-context";
import { runPreview } from "./preview";
import { buildReferenceImplementation } from "./reference-builder";
import { buildLabeledMedia, loadNamedReference } from "./reference-media";
import { refineReferenceImplementation } from "./refine-reference";
import { createSessionId, loadSession, saveSession, sessionDir, updateSession } from "./session";
import type { CliOptions, LabeledMedia, UiAgentSession } from "./types";
import { validateTouchedFiles } from "./validate-changes";
import { compareApprovedReferenceToProduction, writeVisualComparisonReport } from "./visual-comparison";

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

async function ensureSessionWithMedia(options: CliOptions): Promise<{
  session: UiAgentSession;
  referenceMedia: LabeledMedia[];
  currentMedia: LabeledMedia[];
}> {
  let session: UiAgentSession;
  let referenceMedia: LabeledMedia[];
  let currentMedia: LabeledMedia[];

  if (options.sessionId) {
    session = loadSession(options.sessionId);
    referenceMedia = buildLabeledMedia(
      session.referenceMedia.map((m) => ({ path: m.path, label: m.label, purpose: m.purpose })),
    );
    currentMedia = buildLabeledMedia(
      session.currentMedia.map((m) => ({
        path: m.path,
        label: `CURRENT_TRANSOVO_${m.viewport || basename(m.path)}`,
        purpose: "Current Transovo rendered page",
      })),
    );
    return { session, referenceMedia, currentMedia };
  }

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
    generatedDir: generatedDirForSession(""),
  };
  session.generatedDir = generatedDirForSession(session.id);
  saveSession(session);

  log("resolving target route", options.target);
  log("collecting existing implementation", `${manifest.targetFiles.length} files`);

  referenceMedia = await collectReferenceMedia(options, sessionDir(session.id));
  if (referenceMedia.length === 0) throw new Error("Provide --reference-image, --reference-video, or --reference-url");

  log("capturing current UI", options.captureCurrent ? "automatic" : "manual/supplied");
  currentMedia = await collectCurrentMedia(options, session);

  session.referenceMedia = referenceMedia.map((m) => ({
    label: m.label,
    purpose: m.purpose,
    path: m.path,
    source: "user",
  }));
  updateSession(session);

  return { session, referenceMedia, currentMedia };
}

/** Kimi builds complete visual reference in .ui-agent/generated/ — never touches src/ */
async function runImprove(options: CliOptions): Promise<void> {
  ensureUiAgentDirs();
  const provider = await KimiVisionProvider.createValidated();
  const { session, referenceMedia, currentMedia } = await ensureSessionWithMedia(options);

  log("building Kimi reference implementation", session.generatedDir || generatedDirForSession(session.id));
  const build = await buildReferenceImplementation(provider, {
    sessionId: session.id,
    target: session.target,
    manifest: session.manifest,
    referenceMedia,
    currentMedia,
    instruction: session.instruction,
  });

  let passes = 0;
  const maxPasses = options.maxPasses;
  let lastSummary = build.summary;
  while (passes < maxPasses) {
    passes += 1;
    log("visual refinement pass", `${passes}/${maxPasses}`);
    const refined = await refineReferenceImplementation(provider, {
      sessionId: session.id,
      target: session.target,
      manifest: session.manifest,
      referenceMedia,
      currentMedia,
      instruction: session.instruction,
      originalReferenceMedia: referenceMedia,
      pass: passes,
      maxPasses,
    });
    lastSummary = refined.summary;
  }

  session.refinementPasses = passes;
  updateSession(session);

  log("reference build complete", lastSummary);
  log("preview", `npm run ui:preview -- --session ${session.id}`);
  log("approve when satisfied", `npm run ui:approve -- --session ${session.id}`);
  log("then integrate", `npm run ui:integrate -- --session ${session.id}`);
}

async function runApprove(options: CliOptions): Promise<void> {
  if (!options.sessionId) throw new Error("--session is required");
  const session = loadSession(options.sessionId);
  const approved = approveReference({
    sessionId: session.id,
    target: session.target,
    referenceSources: session.referenceMedia.map((m) => m.path),
    notes: options.instruction,
  });
  session.approved = true;
  updateSession(session);
  log("frozen visual source of truth", approved.generatedFiles.length + " files");
}

/** Cursor integration phase — transplant approved reference into production src/ */
async function runIntegrate(options: CliOptions): Promise<void> {
  if (!options.sessionId) throw new Error("--session is required");
  ensureUiAgentDirs();
  const provider = await KimiVisionProvider.createValidated();
  const session = loadSession(options.sessionId);

  log("generating functional mapping report");
  const mapping = await generateFunctionalMappingReport(provider, {
    sessionId: session.id,
    manifest: session.manifest,
  });

  log("generating production integration plan");
  const integrationPlan = await generateIntegrationPlan(provider, {
    sessionId: session.id,
    manifest: session.manifest,
    mapping,
    instruction: session.instruction,
  });
  session.implementationPlan = integrationPlan;
  updateSession(session);

  const report = writeIntegrationReport(session.id, mapping, integrationPlan);
  const { accepted, rejected } = validateImplementationPlan(integrationPlan);
  log("integration plan ready", `${accepted.length} accepted, ${rejected.length} rejected — ${report}`);

  if (!options.apply) {
    log("complete", "plan-only — run with --apply to transplant into production");
    return;
  }

  if (accepted.length === 0) {
    logError("integrate aborted", "no accepted production changes");
    return;
  }

  const dirtyBefore = readGitDirtyFiles();
  const snapshots = snapshotFiles(accepted.map((c) => c.file));
  log("transplanting presentation into production", options.dryRun ? "dry-run" : `${accepted.length} file(s)`);
  const touched = applyAcceptedChanges(accepted, options.dryRun);

  const outsiders = filesChangedOutsidePlan(dirtyBefore, touched);
  if (outsiders.length > 0) logError("dirty tree conflict", outsiders.join(", "));

  if (!options.dryRun) {
    const validation = validateTouchedFiles(touched);
    if (!validation.ok) {
      logError("validation failed — rolling back", validation.protectedViolations.join(", "));
      restoreSnapshots(snapshots.snapshots);
      return;
    }

    const approvedScreenshot = join(generatedDirForSession(session.id), "screenshot.png");
    if (!existsSync(approvedScreenshot)) {
      logError("visual comparison skipped", "no approved Kimi screenshot.png — run ui:improve refinement first");
    } else {
      log("capturing production page for final visual comparison");
      const afterDir = join(sessionDir(session.id), "after-integrate");
      const productionShots = await captureCurrentSite({
        baseUrl: options.baseUrl,
        targetPath: session.target,
        outputDir: afterDir,
        viewports: ["desktop"],
        screenshots: true,
        video: false,
        email: process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL,
        password: process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD,
      });
      const productionScreenshot = productionShots[0];
      if (productionScreenshot) {
        const comparison = await compareApprovedReferenceToProduction(provider, {
          approvedScreenshotPath: approvedScreenshot,
          productionScreenshotPath: productionScreenshot,
          target: session.target,
          instruction: session.instruction,
        });
        session.verification = comparison;
        updateSession(session);
        const comparisonReport = writeVisualComparisonReport(session.id, comparison);
        log(
          "visual comparison",
          `faithful=${comparison.faithful} visual=${comparison.visualMatch}/100 — ${comparisonReport}`,
        );
      }
    }
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

async function runReference(options: CliOptions): Promise<void> {
  if (!options.referenceUrls[0]) throw new Error("--reference-url is required");
  ensureUiAgentDirs();
  const out = join(UI_AGENT_REFERENCES_DIR, "website-captures", createSessionId());
  mkdirSync(out, { recursive: true });
  for (const url of options.referenceUrls) {
    await captureReferenceUrl({
      url,
      outputDir: out,
      depth: options.referenceDepth,
      screenshots: true,
      video: options.captureVideo,
    });
  }
  log("reference capture complete", out);
}

async function runPreviewCmd(options: CliOptions): Promise<void> {
  if (!options.sessionId) throw new Error("--session is required");
  await runPreview(options.sessionId);
}

async function runValidate(options: CliOptions): Promise<void> {
  if (!options.sessionId) throw new Error("--session is required");
  const session = loadSession(options.sessionId);
  if (!session.implementationPlan) throw new Error("Session has no integration plan — run ui:integrate first");
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
    case "improve":
      await runImprove(options);
      break;
    case "approve":
      await runApprove(options);
      break;
    case "integrate":
      await runIntegrate(options);
      break;
    case "capture":
      await runCapture(options);
      break;
    case "reference":
      await runReference(options);
      break;
    case "preview":
      await runPreviewCmd(options);
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
