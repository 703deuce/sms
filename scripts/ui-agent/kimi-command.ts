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
import { log } from "./logger";
import { initProgress, markProgressError, markProgressReady, progressTailPath, updateProgress } from "./progress";
import { startKimiTiming, markKimiTiming } from "./kimi-timing";
import { createSessionId, loadSession, saveSession, sessionDir, updateSession } from "./session";
import type { CliOptions, LabeledMedia, UiAgentSession, UiVisionProvider } from "./types";

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

export async function runKimiCommand(provider: UiVisionProvider, options: CliOptions): Promise<void> {
  let session: UiAgentSession;

  if (options.sessionId && options.revise) {
    session = loadSession(options.sessionId);
    session.status = "generating";
    updateSession(session);

    const referenceMedia = buildLabeledMedia(
      session.referenceMedia.map((m) => ({ path: m.path, label: m.label, purpose: m.purpose })),
    );
    const currentMedia = await collectCurrentMediaForKimi(options, session);
    const generated = readAllGeneratedSources(session.id);

    log("revising Kimi sandbox", options.instruction || "(no instruction)");
    const result = await provider.analyze({
      systemPrompt: `Revise the Kimi sandbox UI only. Do not touch production. Return JSON with files[].`,
      userPrompt: `Revise generated reference.

INSTRUCTION: ${options.instruction || ""}

EXISTING GENERATED FILES:
${generated.map((f) => `\n--- ${f.path} ---\n${f.content.slice(0, 5000)}`).join("\n")}

Return updated files[] with same schema as original build.`,
      labeledMedia: referenceMedia,
      expectJson: true,
    });

    const parsed = result.parsedJson as { files?: Array<{ path: string; content: string }>; summary?: string };
    if (!parsed.files?.length) throw new Error("Kimi revision returned no files");

    writeGeneratedFiles(session.id, parsed.files);
    await screenshotGeneratedReference(session.id);

    session.status = "ready";
    session.refinementPasses = (session.refinementPasses || 0) + 1;
    updateSession(session);
    writeHandoff(session);
    printKimiReady(session);
    return;
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
    const envPrompt = environmentManifestToPrompt(envManifest);
    const build = await buildReferenceImplementation(provider, {
      sessionId: session.id,
      target: session.target,
      manifest: session.manifest,
      referenceMedia,
      currentMedia,
      instruction: [session.instruction, envPrompt].filter(Boolean).join("\n\n"),
    });

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

    const files = listGeneratedFiles(session.id);
    printKimiReady(session, build.summary, files.length);
    log("preview", kimiUiPreviewPath(session.id));
    log("approve", `npm run ui:approve -- --session ${session.id}`);
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
