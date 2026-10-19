#!/usr/bin/env node
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import aliasPlugin from "./esbuild-monolith-alias-plugin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const newAppRoot = path.join(here, "..");
const repoRoot = path.join(newAppRoot, "..");
const entry = path.join(
  repoRoot,
  "src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts",
);
const outfile = path.join(
  newAppRoot,
  "lib/server/receptionist/runtime/voice-v3-runtime.bundle.mjs",
);

try {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    plugins: [aliasPlugin],
    logLevel: "warning",
    external: ["@prisma/client", "prisma", "server-only"],
  });
  console.log(`Wrote ${outfile}`);
} catch (err) {
  console.error("Voice V3 bundle failed (fallback runtime will be used):", err?.message || err);
  process.exit(1);
}
