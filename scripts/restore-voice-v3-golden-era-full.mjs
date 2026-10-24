#!/usr/bin/env node
/**
 * Restore ALL Voice V3 / LiveKit-related code paths to golden-era anchor a4a63466c.
 * Writes a machine-readable manifest for audit.
 *
 * Usage: node scripts/restore-voice-v3-golden-era-full.mjs [--write-manifest-only]
 */
import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const GOLDEN = "a4a63466c";
const MANIFEST_PATH = path.join(REPO, "docs/VOICE-V3-GOLDEN-ERA-FULL-FILE-MANIFEST.json");

const CODE_PREFIXES = [
  "src/lib/voice-v3/",
  "src/lib/voice-v3-basic/",
  "src/lib/voice/python-runtime-bridge/ensure-voice-v3-livekit-voice-call.ts",
  "src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts",
  "src/lib/voice/python-runtime-bridge/voice-v3-forensics-bridge.ts",
  "src/lib/voice/python-runtime-bridge/record-voice-v3-transfer-outcome-for-python.ts",
  "src/app/api/internal/voice-runtime/",
  "voice-runtime-python/transovo_voice/voice_v3/",
  "voice-runtime-python/tests/test_voice_v3",
  "src/components/voice/voice-v3-browser-call.tsx",
  ".cursor/rules/voice-v3-agent-architecture.mdc",
  ".cursor/rules/transovo-voice-v3-legacy-reuse.mdc",
];

const SCRIPT_GLOB_PATTERNS = [
  /^scripts\/.*voice-v3/i,
  /^scripts\/.*voice_v3/i,
  /^new-app\/scripts\/.*voice-v3/i,
  /^voice-runtime-python\/scripts\/.*voice/i,
];

function listGoldenFiles() {
  const out = execSync(`git ls-tree -r --name-only ${GOLDEN}`, {
    cwd: REPO,
    encoding: "utf8",
  });
  const all = out.trim().split("\n").filter(Boolean);
  const selected = new Set();

  for (const p of all) {
    if (p.startsWith("docs/VOICE-V3") || p.startsWith("docs/voice-v3/")) {
      selected.add(p);
      continue;
    }
    for (const prefix of CODE_PREFIXES) {
      if (p.startsWith(prefix) || p === prefix) {
        selected.add(p);
        break;
      }
    }
    if (SCRIPT_GLOB_PATTERNS.some((re) => re.test(p))) {
      selected.add(p);
    }
  }
  return [...selected].sort();
}

function checkoutGolden(paths) {
  const batchSize = 80;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    execSync(`git checkout ${GOLDEN} -- ${batch.map((p) => JSON.stringify(p).slice(1, -1)).join(" ")}`, {
      cwd: REPO,
      stdio: "inherit",
    });
  }
}

function listTrackedUnder(prefix) {
  try {
    const out = execSync(`git ls-files ${prefix}`, { cwd: REPO, encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function removePostGoldenOnly(trackedPrefix, goldenSet) {
  const removed = [];
  for (const p of listTrackedUnder(trackedPrefix)) {
    if (!goldenSet.has(p)) {
      rmSync(path.join(REPO, p), { force: true });
      removed.push(p);
    }
  }
  return removed;
}

function syncMonolithVoiceV3ToNewApp() {
  const srcRoot = path.join(REPO, "src/lib/voice-v3");
  const destRoot = path.join(REPO, "new-app/lib/server/voice-v3");
  const copied = [];

  function walk(relDir) {
    const abs = path.join(srcRoot, relDir);
    for (const name of readdirSync(abs)) {
      const rel = relDir ? `${relDir}/${name}` : name;
      const absPath = path.join(abs, name);
      if (statSync(absPath).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const dest = path.join(destRoot, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(absPath, dest);
      copied.push(`new-app/lib/server/voice-v3/${rel}`);
    }
  }
  walk("");
  return copied;
}

function removeNewAppOnlyVoiceV3Files(goldenNewAppMirrorSet) {
  const destRoot = path.join(REPO, "new-app/lib/server/voice-v3");
  const removed = [];
  if (!existsSync(destRoot)) return removed;

  function walk(relDir) {
    const abs = path.join(destRoot, relDir);
    for (const name of readdirSync(abs)) {
      const rel = relDir ? `${relDir}/${name}` : name;
      const absPath = path.join(abs, name);
      if (statSync(absPath).isDirectory()) {
        walk(rel);
        continue;
      }
      const repoPath = `new-app/lib/server/voice-v3/${rel}`;
      if (!goldenNewAppMirrorSet.has(repoPath.replace(/^new-app\/lib\/server\/voice-v3\//, ""))) {
        const monoPath = `src/lib/voice-v3/${rel}`;
        if (!existsSync(path.join(REPO, monoPath))) {
          rmSync(absPath, { force: true });
          removed.push(repoPath);
        }
      }
    }
  }
  walk("");
  return removed;
}

function main() {
  const writeOnly = process.argv.includes("--write-manifest-only");
  const goldenPaths = listGoldenFiles();
  const goldenSet = new Set(goldenPaths);

  const manifest = {
    golden_commit: GOLDEN,
    golden_commit_subject: execSync(`git log -1 --format=%s ${GOLDEN}`, {
      cwd: REPO,
      encoding: "utf8",
    }).trim(),
    generated_at: new Date().toISOString(),
    path_count: goldenPaths.length,
    categories: {
      src_lib_voice_v3: goldenPaths.filter((p) => p.startsWith("src/lib/voice-v3/")).length,
      voice_runtime_python_v3: goldenPaths.filter((p) =>
        p.startsWith("voice-runtime-python/transovo_voice/voice_v3/"),
      ).length,
      internal_voice_runtime_api: goldenPaths.filter((p) =>
        p.startsWith("src/app/api/internal/voice-runtime/"),
      ).length,
      python_runtime_bridge: goldenPaths.filter((p) =>
        p.includes("python-runtime-bridge/voice-v3"),
      ).length,
      scripts: goldenPaths.filter((p) => /^scripts\/.*voice-v3/i.test(p)).length,
      new_app_scripts: goldenPaths.filter((p) => p.startsWith("new-app/scripts/")).length,
      docs_voice_v3: goldenPaths.filter((p) => p.startsWith("docs/VOICE-V3") || p.startsWith("docs/voice-v3/")).length,
      cursor_rules: goldenPaths.filter((p) => p.startsWith(".cursor/rules/")).length,
      other: 0,
    },
    paths: goldenPaths,
  };
  manifest.categories.other =
    manifest.path_count -
    Object.values(manifest.categories).reduce((a, b) => a + b, 0) +
    manifest.categories.other;

  if (writeOnly) {
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${MANIFEST_PATH} (${manifest.path_count} paths)`);
    return;
  }

  console.log(`Checking out ${manifest.path_count} golden paths from ${GOLDEN}...`);
  checkoutGolden(goldenPaths);

  const removed = [
    ...removePostGoldenOnly("src/lib/voice-v3/", goldenSet),
    ...removePostGoldenOnly("voice-runtime-python/transovo_voice/voice_v3/", goldenSet),
  ];

  console.log("Syncing full src/lib/voice-v3 → new-app/lib/server/voice-v3 ...");
  const mirrored = syncMonolithVoiceV3ToNewApp();
  // new-app-only integration (session resolve, execute-tool, scheduling adapters) is NOT in the
  // golden monolith tree — never delete it during mirror; restore from current branch HEAD if missing.
  const newAppOnlyPreserve = listTrackedUnder("new-app/lib/server/voice-v3/").filter((p) => {
    const rel = p.replace("new-app/lib/server/voice-v3/", "");
    return !existsSync(path.join(REPO, "src/lib/voice-v3", rel));
  });
  for (const p of newAppOnlyPreserve) {
    const abs = path.join(REPO, p);
    if (!existsSync(abs)) {
      execSync(`git checkout HEAD -- ${JSON.stringify(p).slice(1, -1)}`, {
        cwd: REPO,
        stdio: "inherit",
      });
    }
  }
  const removedNewApp = [];

  manifest.new_app_mirror_files = mirrored.length;
  manifest.removed_post_golden_only = removed;
  manifest.removed_new_app_only = removedNewApp;

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${MANIFEST_PATH}`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        golden: GOLDEN,
        restored_paths: manifest.path_count,
        new_app_mirrored_ts_files: mirrored.length,
        removed_post_golden: removed.length,
        removed_new_app_only: removedNewApp.length,
      },
      null,
      2,
    ),
  );
}

main();
