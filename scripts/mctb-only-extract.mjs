#!/usr/bin/env node
/**
 * MCTB-only extraction runner.
 * Usage:
 *   node scripts/mctb-only-extract.mjs inventory   # generate docs/PRODUCT-CODE-INVENTORY.md
 *   node scripts/mctb-only-extract.mjs archive     # copy dormant paths to ARCHIVE_DIR
 *   node scripts/mctb-only-extract.mjs remove        # delete archived paths from workspace
 *   node scripts/mctb-only-extract.mjs all           # archive then remove
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  DORMANT_PRODUCTS,
  MCTB_REQUIRED_PATHS,
  MCTB_ROUTES,
  SOURCE_TAG,
  EXTRACTION_DATE,
  ARCHIVE_REPO_URL,
} from "./mctb-extraction-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || "/tmp/transovo-archive";
const mode = process.argv[2] || "inventory";

function expandGlob(pattern) {
  const results = [];
  if (!pattern.includes("*")) {
    const full = path.join(ROOT, pattern);
    if (fs.existsSync(full)) results.push(pattern);
    return results;
  }
  const dir = pattern.slice(0, pattern.indexOf("*"));
  const baseDir = path.dirname(dir) || ".";
  const absBase = path.join(ROOT, baseDir);
  if (!fs.existsSync(absBase)) return results;
  const prefix = path.basename(dir);
  const suffix = pattern.slice(pattern.indexOf("*") + 1);
  for (const entry of fs.readdirSync(absBase, { withFileTypes: true })) {
    const name = entry.name;
    if (!name.startsWith(prefix.replace(/\*$/, ""))) continue;
    if (suffix && !name.endsWith(suffix)) continue;
    const rel = path.join(baseDir, name);
    const abs = path.join(ROOT, rel);
    if (entry.isDirectory()) {
      collectTree(abs, rel, results);
    } else {
      results.push(rel);
    }
  }
  return results;
}

function collectTree(absDir, relDir, out) {
  if (!fs.existsSync(absDir)) return;
  const stat = fs.statSync(absDir);
  if (stat.isFile()) {
    out.push(relDir);
    return;
  }
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    collectTree(path.join(absDir, entry.name), path.join(relDir, entry.name), out);
  }
}

function resolveProductPaths() {
  const byProduct = {};
  const all = new Set();
  const keep = new Set(MCTB_REQUIRED_PATHS.map((p) => p.replace(/\/$/, "")));

  for (const [product, cfg] of Object.entries(DORMANT_PRODUCTS)) {
    const paths = [];
    for (const p of cfg.paths) {
      if (p.includes("*")) {
        paths.push(...expandGlob(p));
      } else {
        const abs = path.join(ROOT, p);
        if (fs.existsSync(abs)) {
          const stat = fs.statSync(abs);
          if (stat.isDirectory()) {
            collectTree(abs, p, paths);
          } else {
            paths.push(p);
          }
        }
      }
    }
  const keepPaths = (cfg.keepPaths || []).map((p) => p.replace(/\/$/, ""));
    const filtered = [...new Set(paths)].filter((rel) => {
      const norm = rel.replace(/\/$/, "");
      if (keep.has(norm)) return false;
      if (keepPaths.some((k) => norm === k || norm.startsWith(k + "/"))) return false;
      if (MCTB_REQUIRED_PATHS.some((k) => norm === k || norm.startsWith(k + "/"))) return false;
      return true;
    });
    byProduct[product] = { ...cfg, resolvedPaths: filtered.sort() };
    for (const p of filtered) all.add(p);
  }
  return { byProduct, allPaths: [...all].sort() };
}

function copyFile(srcRel, destRoot) {
  const src = path.join(ROOT, srcRel);
  const dest = path.join(destRoot, srcRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function removePath(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  fs.rmSync(abs, { recursive: true, force: true });
  // prune empty parents up to src/
  let dir = path.dirname(abs);
  while (dir.startsWith(ROOT) && dir !== ROOT) {
    try {
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else break;
    } catch {
      break;
    }
  }
}

function generateInventory(byProduct) {
  const lines = [
    "# Product Code Inventory",
    "",
    `Generated: ${EXTRACTION_DATE}`,
    `Source tag: \`${SOURCE_TAG}\``,
    `Archive repository: ${ARCHIVE_REPO_URL}`,
    "",
    "## Classification Legend",
    "",
    "- **MCTB_REQUIRED** — Required for Missed Call Text Back production",
    "- **SHARED_REQUIRED** — Shared infrastructure used by MCTB",
    "- **DORMANT_PRODUCT** — Archived to separate repository",
    "- **UNUSED** — No active references",
    "- **UNCERTAIN** — Requires manual trace (resolved before deletion)",
    "",
    "## Active Product: Missed Call Text Back",
    "",
    "| Area | Classification | Notes |",
    "|------|----------------|-------|",
    "| `src/lib/mctb/` | MCTB_REQUIRED | Core runtime |",
    "| `src/lib/agents/missed-call-text-back/` | MCTB_REQUIRED | Agent + send pipeline |",
    "| `/dashboard`, `/inbox`, `/voice/missed-calls` | MCTB_REQUIRED | Customer UI |",
    "| `/voice/setup`, `/voice/consent-log`, `/voice/schedule` | MCTB_REQUIRED | Setup + compliance |",
    "| `/voice/analytics`, `/voice/numbers` | MCTB_REQUIRED | Analytics + numbers |",
    "| `/compliance` | SHARED_REQUIRED | A2P / messaging compliance |",
    "| `/integrations` (hub) | SHARED_REQUIRED | Webhooks + API keys |",
    "| `/settings`, billing | SHARED_REQUIRED | Account management |",
    "| Auth, Stripe, Telnyx MCTB webhooks | SHARED_REQUIRED | Platform |",
    "",
    "## Dormant Products",
    "",
  ];

  for (const [name, cfg] of Object.entries(byProduct)) {
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(`- **Status:** DORMANT_PRODUCT`);
    lines.push(`- **Description:** ${cfg.description}`);
    lines.push(`- **Files:** ${cfg.resolvedPaths.length}`);
    if (cfg.routes?.length) {
      lines.push(`- **Routes:** ${cfg.routes.join(", ")}`);
    }
    lines.push("");
    lines.push("<details><summary>Archived paths</summary>");
    lines.push("");
    for (const p of cfg.resolvedPaths.slice(0, 200)) {
      lines.push(`- \`${p}\``);
    }
    if (cfg.resolvedPaths.length > 200) {
      lines.push(`- … and ${cfg.resolvedPaths.length - 200} more`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("## MCTB Public Routes (post-extraction target)");
  lines.push("");
  for (const r of MCTB_ROUTES) lines.push(`- \`${r}\``);
  lines.push("");

  const outPath = path.join(ROOT, "docs/PRODUCT-CODE-INVENTORY.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`Wrote ${outPath}`);
}

function generateArchiveReadme(byProduct, commitHash) {
  const lines = [
    "# Transovo Product Archive",
    "",
    "This repository contains dormant historical Transovo products",
    `removed from the active MCTB production application on ${EXTRACTION_DATE}.`,
    "",
    "## Source",
    "",
    `- **Origin repository:** https://github.com/703deuce/sms`,
    `- **Source tag:** \`${SOURCE_TAG}\``,
    `- **Source commit:** \`${commitHash}\``,
    "",
    "## Archived Products",
    "",
    "| Product | Files | Description |",
    "|---------|-------|-------------|",
  ];
  for (const [name, cfg] of Object.entries(byProduct)) {
    lines.push(`| ${name} | ${cfg.resolvedPaths.length} | ${cfg.description} |`);
  }
  lines.push("");
  lines.push("## Restoration",
    "",
    "Each product directory preserves original `src/` paths under this repository root.",
    "To restore a product:",
    "",
    "1. Review the archived files and `ARCHIVE_MANIFEST.md`",
    "2. Compare shared interfaces against current Transovo `master`",
    "3. Cherry-pick or copy modules into a feature branch",
    "4. Reconcile Prisma schema / env vars / provider webhooks",
    "5. Re-enable product entitlements and Stripe catalog entries",
    "6. Run product-specific test suite from archive",
    "",
  );
  fs.writeFileSync(path.join(ARCHIVE_DIR, "README.md"), lines.join("\n"));
}

function generateArchiveManifest(byProduct) {
  const lines = [
    "# Archive Manifest",
    "",
    `Extraction date: ${EXTRACTION_DATE}`,
    "",
  ];
  for (const [name, cfg] of Object.entries(byProduct)) {
    lines.push(`## ${name}`);
    lines.push("");
    lines.push(cfg.description);
    lines.push("");
    for (const p of cfg.resolvedPaths) lines.push(`- ${p}`);
    lines.push("");
  }
  fs.writeFileSync(path.join(ARCHIVE_DIR, "ARCHIVE_MANIFEST.md"), lines.join("\n"));
}

function getCommitHash() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function archiveFiles(allPaths, byProduct) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const commitHash = getCommitHash();
  fs.writeFileSync(
    path.join(ARCHIVE_DIR, "SOURCE_SNAPSHOT.json"),
    JSON.stringify({ tag: SOURCE_TAG, commit: commitHash, date: EXTRACTION_DATE }, null, 2),
  );
  let copied = 0;
  for (const rel of allPaths) {
    copyFile(rel, ARCHIVE_DIR);
    copied++;
  }
  generateArchiveReadme(byProduct, commitHash);
  generateArchiveManifest(byProduct);
  console.log(`Archived ${copied} files to ${ARCHIVE_DIR}`);
  return { copied, commitHash };
}

function removeFiles(allPaths) {
  let removed = 0;
  // Remove deepest paths first
  const sorted = [...allPaths].sort((a, b) => b.length - a.length);
  const seen = new Set();
  for (const rel of sorted) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    removePath(rel);
    removed++;
  }
  console.log(`Removed ${removed} paths from production`);
}

const { byProduct, allPaths } = resolveProductPaths();
console.log(`Resolved ${allPaths.length} dormant paths across ${Object.keys(byProduct).length} products`);

if (mode === "inventory" || mode === "all") {
  generateInventory(byProduct);
}

if (mode === "archive" || mode === "all") {
  archiveFiles(allPaths, byProduct);
}

if (mode === "remove" || mode === "all") {
  if (mode === "remove" && !fs.existsSync(path.join(ARCHIVE_DIR, "ARCHIVE_MANIFEST.md"))) {
    console.error("Archive manifest not found. Run archive first.");
    process.exit(1);
  }
  removeFiles(allPaths);
}

if (mode === "stats") {
  for (const [name, cfg] of Object.entries(byProduct)) {
    console.log(`${name}: ${cfg.resolvedPaths.length} paths`);
  }
}
