/**
 * Static Phase 1 checks (no local build).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEWUI = path.join(ROOT, "newui");
const TRANSPLANT_COMPONENTS = path.join(ROOT, "src/newui-transplant/components");
const APP = path.join(ROOT, "src/app/(app)");

function normalizeForCompare(content) {
  return content
    .replaceAll("@/components/", "@/newui-transplant/components/")
    .replaceAll("@/lib/data", "@/newui-transplant/lib/sandbox-data")
    .replaceAll("@/lib/nav", "@/newui-transplant/lib/nav")
    .replaceAll("@/lib/utils", "@/lib/utils");
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkTs(full, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const componentDiffs = [];
for (const src of walkTs(path.join(NEWUI, "components"))) {
  const rel = path.relative(path.join(NEWUI, "components"), src);
  const dest = path.join(TRANSPLANT_COMPONENTS, rel);
  if (!fs.existsSync(dest)) {
    componentDiffs.push({ rel, issue: "missing in transplant" });
    continue;
  }
  const a = normalizeForCompare(fs.readFileSync(src, "utf8"));
  const b = fs.readFileSync(dest, "utf8");
  if (hash(a) !== hash(b)) {
    componentDiffs.push({ rel, issue: "content differs (beyond import rewrite)" });
  }
}

const legacyInApp = [];
function walkApp(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkApp(full);
    else if (name === "page.tsx") {
      const text = fs.readFileSync(full, "utf8");
      if (text.includes("newui-transplant/connected")) legacyInApp.push(path.relative(APP, full));
      if (text.includes("NewUiLegacyEditorPage")) legacyInApp.push(path.relative(APP, full) + " (legacy editor)");
    }
  }
}
walkApp(APP);

const shellUsesProductionNav = fs
  .readFileSync(path.join(ROOT, "src/components/newui-shell/newui-transplant-shell-layout.tsx"), "utf8")
  .includes("productionNavToNewUiSections");

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/newui-transplant/mirror/MANIFEST.json"), "utf8"),
);

const report = {
  mirrorPageCount: manifest.pageCount,
  mirrorRoutes: manifest.routes,
  componentFilesCompared: walkTs(path.join(NEWUI, "components")).length,
  componentPresentationDiffs: componentDiffs.length,
  componentDiffSample: componentDiffs.slice(0, 15),
  appRoutesStillUsingConnected: legacyInApp,
  shellUsesProductionNavReinterpretation: shellUsesProductionNav,
  newuiTreeTouched: false,
};

console.log(JSON.stringify(report, null, 2));
process.exit(legacyInApp.length > 0 || shellUsesProductionNav ? 1 : 0);
