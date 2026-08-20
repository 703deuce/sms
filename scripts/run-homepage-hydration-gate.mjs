#!/usr/bin/env node
/**
 * Full TypeScript + production build + hydration gate.
 * 1. Remove generated .next output
 * 2. npx tsc --noEmit
 * 3. npm run build
 * 4. Self-start production server and run hydration browser test
 */
import { spawnSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";

function runStep(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const proc = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (proc.status !== 0) {
    console.error(`FAIL ${label}`);
    process.exit(proc.status ?? 1);
  }
  console.log(`PASS ${label}`);
}

if (existsSync(".next")) {
  console.log("Removing .next for clean build/typecheck gate");
  rmSync(".next", { recursive: true, force: true });
}

runStep("TypeScript", "npx", ["tsc", "--noEmit"]);
runStep("Production build", "npm", ["run", "build"]);
runStep("Hydration browser test", "node", ["scripts/run-homepage-number-search-hydration.mjs"], {
  env: {
    ...process.env,
    BASE_URL: process.env.BASE_URL?.trim() || "http://127.0.0.1:3000",
    HYDRATION_TEST_AUTO_START: "1",
  },
});

console.log("\nPASS homepage hydration gate (clean build + tsc + hydration)");
