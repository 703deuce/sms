import type { CliOptions } from "./types";

function nextValue(args: string[], index: number): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${args[index]}`);
  }
  return value;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = {
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
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
    walkthrough: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop", "mobile"],
    maxPasses: 2,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--target":
        options.target = nextValue(args, i++);
        break;
      case "--session":
        options.sessionId = nextValue(args, i++);
        break;
      case "--instruction":
        options.instruction = nextValue(args, i++);
        break;
      case "--video":
        options.referenceVideoNames.push(nextValue(args, i++));
        break;
      case "--image":
        options.referenceImageNames.push(nextValue(args, i++));
        break;
      case "--reference-image":
      case "--image-file":
        options.referenceImages.push(nextValue(args, i++));
        break;
      case "--reference-video":
      case "--video-file":
        options.referenceVideos.push(nextValue(args, i++));
        break;
      case "--reference-url":
        options.referenceUrls.push(nextValue(args, i++));
        break;
      case "--reference-name":
        options.referenceNames.push(nextValue(args, i++));
        break;
      case "--current-image":
        options.currentImages.push(nextValue(args, i++));
        break;
      case "--current-video":
        options.currentVideos.push(nextValue(args, i++));
        break;
      case "--capture-current":
        options.captureCurrent = true;
        break;
      case "--screenshots":
        options.captureScreenshots = true;
        break;
      case "--no-screenshots":
        options.captureScreenshots = false;
        break;
      case "--video-capture":
      case "--capture-video":
        options.captureVideo = true;
        break;
      case "--no-reference":
        options.skipAutoReference = true;
        break;
      case "--reference-depth":
        options.referenceDepth = nextValue(args, i++) as "page" | "flow";
        break;
      case "--plan-only":
        options.planOnly = true;
        options.apply = false;
        break;
      case "--apply":
        options.apply = true;
        options.planOnly = false;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--max-passes":
        options.maxPasses = Number(nextValue(args, i++));
        break;
      case "--model":
        options.kimiModel = nextValue(args, i++);
        break;
      case "--reasoning-effort":
        options.reasoningEffort = nextValue(args, i++) as CliOptions["reasoningEffort"];
        break;
      case "--revise":
        options.revise = true;
        break;
      case "--mode":
        options.mode = nextValue(args, i++) as CliOptions["mode"];
        break;
      case "--walkthrough":
        options.walkthrough = true;
        break;
      case "--complete":
        options.complete = true;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function printUsage(): void {
  console.log(`Visual UI Agent — Cursor orchestrates Kimi for visual UI work

PRIMARY (Cursor-controlled):
  # GENERATION — reference video → sandbox UI
  npm run ui:kimi -- \\
    --target "/conversations" \\
    --video "slicktext-inbox" \\
    --instruction "Match inbox layout; keep Transovo sidebar"

  # POLISH — existing production page → tighten real frontend in place
  npm run ui:kimi -- \\
    --mode polish \\
    --target "/campaigns" \\
    --walkthrough \\
    --capture-current \\
    --apply \\
    --instruction "Keep structure. Improve color hierarchy, buttons, table polish."
  # Auto-attaches the reference video for the route from .ui-agent/references.json
  # Override with --video "name" or disable with --no-reference

  npm run ui:kimi -- --session <id> --revise --instruction "Tighten row spacing"

  npm run ui:kimi -- --session <id> --complete
  npm run ui:kimi -- --session <id> --complete --instruction "Focus on workflow builder canvas"

REFERENCE LIBRARY:
  npm run ui:refs
  npm run ui:refs -- --show slicktext-inbox

WORKFLOW:
  1. ui:kimi        Kimi builds sandbox in .ui-agent/generated/<session>/
  2. /transovo/kimi/preview/<session>   Compare Current vs Kimi
  3. ui:approve     Freeze approved visual target
  4. ui:integrate   Cursor integrates into production src/

LEGACY ALIASES: ui:improve (= ui:kimi), ui:preview, ui:capture, ui:reference

OPTIONS:
  --mode generate|polish (default: generate)
  --target, --session, --instruction, --revise, --complete, --walkthrough
  --video, --image (named references from .ui-agent/references.json)
  --video-file, --image-file, --reference-video, --reference-image (local paths)
  --no-reference (polish mode: skip auto route reference video)
  --reference-url, --reference-name, --capture-current
  --apply, --dry-run, --max-passes (default 2)
  --base-url http://localhost:3000
`);
}
