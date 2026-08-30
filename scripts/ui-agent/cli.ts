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
      case "--image":
      case "--reference-image":
        options.referenceImages.push(nextValue(args, i++));
        break;
      case "--video":
      case "--reference-video":
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
      case "--analyze-only":
        options.analyzeOnly = true;
        break;
      case "--base-url":
        options.baseUrl = nextValue(args, i++).replace(/\/$/, "");
        break;
      case "--max-passes":
        options.maxPasses = Number(nextValue(args, i++));
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.apply && !options.dryRun) {
    options.planOnly = true;
  }

  return options;
}

export function printUsage(): void {
  console.log(`Usage:
  npm run ui:analyze -- --target "/conversations" --reference-image ./ref.png
  npm run ui:improve -- --target "/conversations" --reference-video ./ref.mov --capture-current --plan-only
  npm run ui:improve -- --session <id> --apply
  npm run ui:capture -- --target "/conversations" --screenshots --video-capture
  npm run ui:validate -- --session <id>

Options:
  --target <route|component-path>   Required for new sessions
  --reference-image <path>          Reference screenshot (repeatable)
  --reference-video <path>          Reference screen recording (repeatable)
  --reference-url <url>             Capture public reference website
  --reference-name <name>           Reuse saved reference from .ui-agent/references/
  --current-image <path>            Manual current-site screenshot
  --current-video <path>            Manual current-site recording
  --capture-current                 Auto-capture current Transovo page
  --screenshots / --no-screenshots
  --video-capture                   Capture walkthrough video
  --instruction <text>              Additional direction
  --plan-only                       Default — analyze/plan only
  --apply                           Apply validated UI changes
  --dry-run                         Show apply actions without writing
  --session <id>                    Resume a saved session
  --base-url <url>                  App URL for capture (default localhost:3000)
`);
}
