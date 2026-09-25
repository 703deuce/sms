#!/usr/bin/env node
/**
 * Lists reachable Voice + MCTB app routes from src/app (Pass 3 inventory).
 *   node scripts/pass3-route-inventory.mjs
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src/app");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name === "page.tsx" || name === "page.ts") acc.push(p);
  }
  return acc;
}

function toRoute(file) {
  let r = relative(ROOT, file).replace(/\/page\.tsx?$/, "");
  r = r.replace(/^\(app\)\//, "").replace(/^\(public\)\//, "public/");
  const segments = r.split("/").filter((s) => !s.startsWith("(") && !s.endsWith(")"));
  return "/" + segments.join("/");
}

const pages = walk(ROOT);
const voice = [];
const mctb = [];
for (const f of pages.sort()) {
  const route = toRoute(f);
  if (route.startsWith("/voice") || route.startsWith("/onboarding/mctb")) voice.push(route);
  else if (route.startsWith("/mctb") || route === "/analytics/mctb" || route.startsWith("/f/mctb"))
    mctb.push(route);
}

console.log(JSON.stringify({ voice, mctb, voiceCount: voice.length, mctbCount: mctb.length }, null, 2));
