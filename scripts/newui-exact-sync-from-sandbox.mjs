/**
 * Copy approved newui/ presentation tree into src/newui-transplant/ (exact code).
 * Rewrites imports only. Does not modify newui/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEWUI = path.join(ROOT, "newui");
const TRANSPLANT = path.join(ROOT, "src/newui-transplant");
const MIRROR_ROUTES = path.join(TRANSPLANT, "mirror/routes");
const LEGACY_MIRROR = path.join(TRANSPLANT, "mirror/(app)");

function rewriteSource(content) {
  return content
    .replaceAll("@/components/", "@/newui-transplant/components/")
    .replaceAll("@/lib/data", "@/newui-transplant/lib/sandbox-data")
    .replaceAll("@/lib/nav", "@/newui-transplant/lib/nav")
    .replaceAll("@/lib/utils", "@/lib/utils")
    .replaceAll("@/hooks/", "@/newui-transplant/hooks/");
}

function walkCopy(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    if (fs.statSync(src).isDirectory()) {
      walkCopy(src, dest);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      const raw = fs.readFileSync(src, "utf8");
      fs.writeFileSync(dest, rewriteSource(raw));
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function segmentToPascal(segment) {
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const inner = segment.slice(1, -1);
    return inner.charAt(0).toUpperCase() + inner.slice(1);
  }
  return segment
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

/** voice/calls/[id]/page.tsx → TransplantVoiceCallsIdPage */
function defaultExportName(relRoutePath) {
  const routeOnly = relRoutePath.replace(/\/page\.tsx$/, "");
  if (!routeOnly) return "TransplantNewUiHomeRedirectPage";
  const segments = routeOnly.split("/").filter(Boolean).map(segmentToPascal);
  return `Transplant${segments.join("")}Page`;
}

function stripNextMetadata(content) {
  let out = content;
  out = out.replace(/^import type \{ Metadata \} from ['"]next['"]\s*\n/m, "");
  out = out.replace(/^export const metadata[\s\S]*?;\s*\n/m, "");
  return out;
}

function renameDefaultExport(content, exportName) {
  let out = content;
  if (out.includes(`export async function ${exportName}`) || out.includes(`export function ${exportName}`)) {
    return out;
  }
  out = out.replace(/export default async function \w+\(/, `export async function ${exportName}(`);
  out = out.replace(/export default function \w+\(/, `export function ${exportName}(`);
  return out;
}

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) rmrf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

function syncPages() {
  const appRoot = path.join(NEWUI, "app");
  const pages = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") pages.push(full);
    }
  }
  walk(appRoot);

  rmrf(MIRROR_ROUTES);
  fs.mkdirSync(MIRROR_ROUTES, { recursive: true });

  const exports = [];

  for (const abs of pages) {
    const relFromApp = path.relative(path.join(NEWUI, "app"), abs);
    const routeRel = relFromApp.replace(/^\(app\)\//, "");
    const out = path.join(MIRROR_ROUTES, routeRel);
    fs.mkdirSync(path.dirname(out), { recursive: true });

    let content = fs.readFileSync(abs, "utf8");
    content = rewriteSource(content);
    content = stripNextMetadata(content);
    const exportName = defaultExportName(routeRel);
    content = renameDefaultExport(content, exportName);
    fs.writeFileSync(out, content);

    const importPath = `./routes/${routeRel.replace(/\.tsx$/, "")}`;
    exports.push({ exportName, importPath, productionRoute: routeToProductionRoute(routeRel) });
  }

  return { pageCount: pages.length, exports };
}

function routeToProductionRoute(routeRel) {
  const base = routeRel.replace(/\/page\.tsx$/, "");
  if (base === "page.tsx" || base === "") return "/";
  return `/${base}`;
}

// 1) sandbox data
fs.mkdirSync(path.join(TRANSPLANT, "lib"), { recursive: true });
fs.copyFileSync(path.join(NEWUI, "lib/data.ts"), path.join(TRANSPLANT, "lib/sandbox-data.ts"));

const navSrc = path.join(NEWUI, "lib/nav.ts");
const navDest = path.join(TRANSPLANT, "lib/nav.ts");
if (fs.existsSync(navSrc)) {
  fs.writeFileSync(navDest, rewriteSource(fs.readFileSync(navSrc, "utf8")));
}

// 2) components
walkCopy(path.join(NEWUI, "components"), path.join(TRANSPLANT, "components"));

// 3) mirror pages under mirror/routes/
const { pageCount, exports } = syncPages();

if (fs.existsSync(LEGACY_MIRROR)) {
  rmrf(LEGACY_MIRROR);
}
const legacyRootPage = path.join(TRANSPLANT, "mirror/page.tsx");
if (fs.existsSync(legacyRootPage)) fs.unlinkSync(legacyRootPage);

// 4) barrel exports for stable imports
const barrelLines = [
  "/** Auto-generated by scripts/newui-exact-sync-from-sandbox.mjs — do not edit. */",
  "",
  ...exports
    .sort((a, b) => a.productionRoute.localeCompare(b.productionRoute))
    .map((e) => `export { ${e.exportName} } from "${e.importPath}";`),
  "",
];
fs.writeFileSync(path.join(TRANSPLANT, "mirror/page-exports.ts"), barrelLines.join("\n"));

const manifest = exports.map((e) => e.productionRoute).sort();
fs.writeFileSync(
  path.join(TRANSPLANT, "mirror/MANIFEST.json"),
  JSON.stringify({ syncedAt: new Date().toISOString(), pageCount, routes: manifest }, null, 2),
);

console.log(JSON.stringify({ pageCount, routes: manifest.length, exports: exports.length }, null, 2));
