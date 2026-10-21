#!/usr/bin/env node
/**
 * Sync golden Voice V3 executor modules from monolith authority into new-app mirror.
 * Run before new-app production build and in CI parity workflows.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MUST_MATCH_RELATIVE_PATHS } from "./must-match-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const MONO_ROOT = path.join(REPO_ROOT, "src/lib/voice-v3");
const APP_ROOT = path.join(REPO_ROOT, "new-app/lib/server/voice-v3");

let copied = 0;
for (const rel of MUST_MATCH_RELATIVE_PATHS) {
  const src = path.join(MONO_ROOT, rel);
  const dest = path.join(APP_ROOT, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  copied += 1;
}

console.log(
  JSON.stringify({
    event: "voice_v3_authority_sync_to_new_app",
    authority: "src/lib/voice-v3",
    destination: "new-app/lib/server/voice-v3",
    files_copied: copied,
  }),
);
