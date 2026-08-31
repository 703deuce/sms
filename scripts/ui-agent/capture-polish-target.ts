/**
 * Capture walkthrough screenshots for a polish target (production / staging).
 *
 *   # Before polish (baseline on live site)
 *   DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=$APP_URL npm run ui:kimi-capture-polish -- --target /campaigns
 *
 *   # After Coolify deploy (verify polish landed)
 *   DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=$APP_URL npm run ui:kimi-capture-polish -- --target /campaigns --phase after
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { captureWalkthrough } from "./capture-walkthrough";
import { resolvePolishTarget } from "./polish-targets";
import { log } from "./logger";

function parseArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

async function main() {
  const target = parseArg("--target") || "/campaigns";
  const phase = parseArg("--phase") === "after" ? "after" : "before";
  const baseUrl =
    parseArg("--base-url") ||
    process.env.UI_AGENT_BASE_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    "http://localhost:3000";
  const config = resolvePolishTarget(target);
  if (!config) throw new Error(`No walkthrough config for ${target}`);

  const slug = target.replace(/^\//, "").replace(/\//g, "-");
  const out = join("/opt/cursor/artifacts", `polish-${slug}-${phase}`);
  mkdirSync(out, { recursive: true });

  const paths = await captureWalkthrough({
    baseUrl,
    outputDir: out,
    steps: config.steps,
    useDevBypass:
      process.env.UI_AGENT_DEV_BYPASS === "1" ||
      process.env.DEV_AUTH_BYPASS === "1" ||
      process.env.DEV_AUTH_BYPASS === "true",
    email: process.env.UI_AGENT_SMOKE_EMAIL || process.env.SMOKE_EMAIL,
    password: process.env.UI_AGENT_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD,
  });

  log("capture complete", `${paths.length} ${phase} screenshots → ${out}`);
  for (const p of paths) console.log(p);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
