/**
 * Ensures every /api/appointment-reminders/* path referenced from AR UI
 * has a matching route.ts under src/app/api/appointment-reminders.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const uiRoots = [
  join(root, "src/newui-transplant/connected/appointment-reminders"),
  join(root, "src/newui-transplant/components/appointment-reminders"),
  join(root, "src/app/(app)/appointment-reminders"),
  join(root, "src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx"),
];

const apiRoot = join(root, "src/app/api/appointment-reminders");

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectRouteFiles(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function routeFileToUrlPath(file: string): string {
  const rel = relative(apiRoot, file).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  const segments = withoutRoute.split("/").filter((s) => !s.startsWith("["));
  return `/api/appointment-reminders/${segments.join("/")}`;
}

const routeFiles = collectRouteFiles(apiRoot);
const routePrefixes = routeFiles.map(routeFileToUrlPath);

const pathRe =
  /\/api\/appointment-reminders\/[a-zA-Z0-9_\-/[\]]+/g;

const referenced = new Set<string>();
for (const uiRoot of uiRoots) {
  if (!existsSync(uiRoot)) continue;
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const c of readdirSync(p)) walk(join(p, c));
      return;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(p)) return;
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(pathRe)) {
      let path = m[0].split("?")[0].replace(/\/$/, "");
      path = path.replace(/\$\{[^}]+\}/g, "placeholder");
      if (path.includes("placeholder")) {
        const base = path.split("/placeholder")[0];
        referenced.add(base);
      } else {
        referenced.add(path);
      }
    }
  };
  walk(uiRoot);
}

const missing: string[] = [];
for (const ref of referenced) {
  const ok = routePrefixes.some((prefix) => ref === prefix || ref.startsWith(`${prefix}/`));
  if (!ok) missing.push(ref);
}

assert.equal(missing.length, 0, `AR UI references missing API routes: ${missing.join(", ")}`);

console.log(
  `test-ar-ui-api-wiring.ts PASS (${referenced.size} UI API references, ${routeFiles.length} route files)`,
);
