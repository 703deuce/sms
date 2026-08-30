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
    approve: false,
    integrate: false,
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
      case "--max-passes":
        options.maxPasses = Number(nextValue(args, i++));
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function printUsage(): void {
  console.log(`Visual UI Agent — Kimi builds reference, Cursor integrates production

WORKFLOW:
  1. ui:improve     Kimi builds reference in .ui-agent/generated/<session>/
  2. ui:preview     Inspect the reference page locally
  3. ui:approve     Freeze APPROVED.json when satisfied
  4. ui:integrate   Transplant presentation into real src/ (plan-only default)
  5. ui:integrate --apply   Apply production changes

COMMANDS:
  npm run ui:improve -- \\
    --target "/conversations" \\
    --reference-video "./ref.mov" \\
    --capture-current \\
    --instruction "Match inbox layout; keep Transovo sidebar"

  npm run ui:preview -- --session <session-id>
  npm run ui:approve -- --session <session-id>
  npm run ui:integrate -- --session <session-id>          # plan only
  npm run ui:integrate -- --session <session-id> --apply  # transplant to src/

  npm run ui:capture -- --target "/conversations" --screenshots --video-capture
  npm run ui:reference -- --reference-url "https://example.com/inbox"
  npm run ui:validate -- --session <session-id>

OPTIONS:
  --target, --session, --instruction
  --reference-image, --reference-video, --reference-url, --reference-name
  --current-image, --current-video, --capture-current
  --apply, --dry-run, --max-passes (default 2 Kimi refinement passes)
  --base-url http://localhost:3000
`);
}
