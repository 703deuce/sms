#!/usr/bin/env node
/**
 * Enumerate every tracked path that touches Voice V3 / LiveKit and assert:
 * - Monolith + python + docs in manifest match golden blob at a4a63466c
 * - new-app mirror files match monolith twin when one exists
 * - Remaining new-app-only paths are explicitly listed (integration layer)
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const GOLDEN = "a4a63466c";
const MANIFEST = path.join(REPO, "docs/VOICE-V3-GOLDEN-ERA-FULL-FILE-MANIFEST.json");

const TOUCH_PATTERNS = [
  /^src\/lib\/voice-v3\//,
  /^src\/lib\/voice-v3-basic\//,
  /^new-app\/lib\/server\/voice-v3\//,
  /^voice-runtime-python\/transovo_voice\/voice_v3\//,
  /^src\/lib\/voice\/python-runtime-bridge\/voice-v3/,
  /^src\/app\/api\/internal\/voice-runtime\//,
  /^packages\/transovo-voice-v3-runtime\//,
  /^docs\/VOICE-V3/,
  /^\.cursor\/rules\/.*voice-v3/i,
  /^\.cursor\/rules\/transovo-voice-v3/i,
];

const SCRIPT_PATTERNS = [
  /^scripts\/.*voice-v3/i,
  /^scripts\/.*voice_v3/i,
  /^new-app\/scripts\/.*voice-v3/i,
];

function listTracked() {
  return execSync("git ls-files", { cwd: REPO, encoding: "utf8" }).trim().split("\n").filter(Boolean);
}

function isVoiceV3Touch(p) {
  if (TOUCH_PATTERNS.some((re) => re.test(p))) return true;
  if (SCRIPT_PATTERNS.some((re) => re.test(p))) return true;
  if (p.includes("voice_v3") || p.includes("voice-v3")) return true;
  return false;
}

function blobAtGolden(repoPath) {
  return execSync(`git rev-parse ${GOLDEN}:${repoPath}`, { cwd: REPO, encoding: "utf8" }).trim();
}

function blobAtWorking(repoPath) {
  return execSync(`git hash-object ${repoPath}`, { cwd: REPO, encoding: "utf8" }).trim();
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.error("Missing manifest:", MANIFEST);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const goldenSet = new Set(manifest.paths);

  const postGoldenDocsPath = path.join(
    REPO,
    "docs/VOICE-V3-GOLDEN-ERA-POST-GOLDEN-DOCUMENTATION-MANIFEST.json",
  );
  let postGoldenDocs = new Set();
  if (existsSync(postGoldenDocsPath)) {
    postGoldenDocs = new Set(JSON.parse(readFileSync(postGoldenDocsPath, "utf8")).paths);
  }

  const touched = listTracked().filter(isVoiceV3Touch).sort();
  const drift = [];
  const newAppOnly = [];
  let goldenAuthority = 0;
  let newAppMirror = 0;

  for (const p of touched) {
    if (p.startsWith("new-app/lib/server/voice-v3/")) {
      const rel = p.replace("new-app/lib/server/voice-v3/", "");
      const mono = `src/lib/voice-v3/${rel}`;
      const monoAbs = path.join(REPO, mono);
      if (existsSync(monoAbs)) {
        newAppMirror++;
        const a = blobAtWorking(p);
        const b = blobAtWorking(mono);
        if (a !== b) {
          drift.push({ path: p, reason: "new-app mirror differs from src/lib/voice-v3 twin" });
        }
        continue;
      }
      newAppOnly.push(p);
      continue;
    }

    if (goldenSet.has(p)) {
      goldenAuthority++;
      try {
        const current = blobAtWorking(p);
        const expected = blobAtGolden(p);
        if (current !== expected) {
          drift.push({ path: p, reason: "differs from golden commit blob" });
        }
      } catch (e) {
        drift.push({ path: p, reason: String(e.message || e) });
      }
      continue;
    }

    if (postGoldenDocs.has(p)) {
      newAppOnly.push(p);
      continue;
    }

    if (
      p.startsWith("new-app/") ||
      p.startsWith("packages/transovo-voice-v3-runtime/") ||
      p.startsWith("docs/VOICE-V3") ||
      p.startsWith("docs/voice-v3/") ||
      p.startsWith("docs/forensics-voice-v3") ||
      p.startsWith("reports/") ||
      p.startsWith("prisma/migrations/")
    ) {
      newAppOnly.push(p);
      continue;
    }

    const postGoldenScriptsPath = path.join(REPO, "docs/VOICE-V3-GOLDEN-ERA-POST-GOLDEN-SCRIPTS-MANIFEST.json");
    if (p.startsWith("scripts/") && existsSync(postGoldenScriptsPath)) {
      const allowed = new Set(JSON.parse(readFileSync(postGoldenScriptsPath, "utf8")).paths);
      if (allowed.has(p)) {
        newAppOnly.push(p);
        continue;
      }
    }

    drift.push({ path: p, reason: "voice-v3 touch not in golden manifest (unexpected)" });
  }

  const integrationManifestPath = path.join(
    REPO,
    "docs/VOICE-V3-GOLDEN-ERA-NEW-APP-INTEGRATION-MANIFEST.json",
  );
  let integrationListed = new Set();
  if (existsSync(integrationManifestPath)) {
    integrationListed = new Set(JSON.parse(readFileSync(integrationManifestPath, "utf8")).paths);
  }
  const unlistedIntegration = newAppOnly.filter(
    (p) => !integrationListed.has(p) && !postGoldenDocs.has(p),
  );

  const report = {
    golden_commit: GOLDEN,
    manifest_authority_paths: manifest.path_count,
    repo_voice_v3_touch_count: touched.length,
    golden_authority_files_verified: goldenAuthority,
    new_app_mirror_files_verified: newAppMirror,
    new_app_integration_files: newAppOnly.length,
    new_app_integration_unlisted: unlistedIntegration.length,
    drift_count: drift.length,
    drift,
    new_app_integration_paths: newAppOnly,
  };

  console.log(JSON.stringify(report, null, 2));

  if (drift.length > 0 || unlistedIntegration.length > 0) {
    process.exit(1);
  }
}

main();
