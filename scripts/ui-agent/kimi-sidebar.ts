/**
 * Kimi sidebar-only generation from SlickText inbox reference video.
 *
 *   npm run ui:kimi-sidebar
 *   npm run ui:kimi-sidebar -- --video "Creating Automated Workflows..."
 */
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import { KIMI_SIDEBAR_ONLY_INSTRUCTION } from "./config";
import { ensureUiAgentDirs } from "./config";
import type { CliOptions } from "./types";

const DEFAULT_VIDEO = "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)";

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function buildOptions(videoName: string): CliOptions {
  return {
    target: "/conversations",
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [videoName],
    referenceImageNames: [],
    currentImages: [],
    currentVideos: [],
    captureCurrent: false,
    captureScreenshots: true,
    captureVideo: false,
    referenceDepth: "page",
    planOnly: true,
    apply: false,
    dryRun: false,
    analyzeOnly: false,
    approve: false,
    integrate: false,
    revise: false,
    complete: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 0,
    reasoningEffort: "low",
    instruction: KIMI_SIDEBAR_ONLY_INSTRUCTION,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const video = parseArg(args, "--video") || DEFAULT_VIDEO;
  ensureUiAgentDirs();

  console.log("\nKimi sidebar-only — reference video:", video);
  console.log("Target sandbox context: /conversations (sidebar-only output)\n");

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });
  const result = await runKimiCommand(provider, buildOptions(video));
  console.log(`\nDone — session ${result.sessionId} (${result.fileCount} files)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
