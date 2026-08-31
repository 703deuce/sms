/**
 * Promote Kimi draft UI into src/components/kimi/<slug>/ and wire route pages (mock only).
 *
 *   npx tsx scripts/ui-agent/integrate-kimi-ui.ts
 *   npx tsx scripts/ui-agent/integrate-kimi-ui.ts --only contacts
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BatchState } from "./kimi-batch-pages";

const REPO = process.cwd();
const DRAFTS = join(REPO, "src/kimi-drafts");
const KIMI = join(REPO, "src/components/kimi");
const STYLES = join(REPO, "src/styles/kimi");
const GLOBALS = join(REPO, "src/app/globals.css");
const BATCH_STATE = join(REPO, ".ui-agent/batch/kimi-slicktext-pages.json");

type RouteJob = {
  route: string;
  slug: string;
  sessionId?: string;
  flowName: string;
  pagePath: string;
  cssClass: string;
};

const JOBS: RouteJob[] = [
  {
    route: "/auto-replies",
    slug: "auto-replies",
    flowName: "AutoRepliesFlow",
    pagePath: "src/app/(app)/auto-replies/page.tsx",
    cssClass: "kimi-auto-replies",
  },
  {
    route: "/campaigns",
    slug: "campaigns",
    flowName: "CampaignsUiFlow",
    pagePath: "src/app/(app)/campaigns/page.tsx",
    cssClass: "kimi-campaigns",
  },
  {
    route: "/contacts",
    slug: "contacts",
    flowName: "ContactsFlow",
    pagePath: "src/app/(app)/contacts/page.tsx",
    cssClass: "kimi-contacts",
  },
  {
    route: "/contacts/fields",
    slug: "contacts-fields",
    flowName: "ContactsFieldsFlow",
    pagePath: "src/app/(app)/contacts/fields/page.tsx",
    cssClass: "kimi-contacts-fields",
  },
  {
    route: "/contacts/lists",
    slug: "contacts-lists",
    flowName: "ContactsListsFlow",
    pagePath: "src/app/(app)/contacts/lists/page.tsx",
    cssClass: "kimi-contacts-lists",
  },
  {
    route: "/conversations",
    slug: "conversations",
    flowName: "ConversationsFlow",
    pagePath: "src/app/(app)/conversations/page.tsx",
    cssClass: "kimi-conversations",
  },
  {
    route: "/grow/keywords",
    slug: "grow-keywords",
    flowName: "GrowKeywordsFlow",
    pagePath: "src/app/(app)/grow/keywords/page.tsx",
    cssClass: "kimi-grow-keywords",
  },
  {
    route: "/grow/qr-codes",
    slug: "grow-qr-codes",
    flowName: "GrowQrCodesFlow",
    pagePath: "src/app/(app)/grow/qr-codes/page.tsx",
    cssClass: "kimi-grow-qr-codes",
  },
  {
    route: "/grow/tap-to-join",
    slug: "grow-tap-to-join",
    flowName: "GrowTapToJoinFlow",
    pagePath: "src/app/(app)/grow/tap-to-join/page.tsx",
    cssClass: "kimi-grow-tap-to-join",
  },
  {
    route: "/messaging/media",
    slug: "messaging-media",
    flowName: "MessagingMediaFlow",
    pagePath: "src/app/(app)/messaging/media/page.tsx",
    cssClass: "kimi-messaging-media",
  },
];

function parseArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function draftFileCount(slug: string, sessionId: string): number {
  const manifestPath = join(DRAFTS, slug, sessionId, "MANIFEST.json");
  if (!existsSync(manifestPath)) return 0;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { generatedFiles?: string[] };
  return manifest.generatedFiles?.length ?? 0;
}

function bestSessionForSlug(slug: string): string | undefined {
  const slugDir = join(DRAFTS, slug);
  if (!existsSync(slugDir)) return undefined;

  let best: { sessionId: string; score: number } | undefined;
  for (const sessionId of readdirSync(slugDir)) {
    if (!existsSync(join(slugDir, sessionId, "page.tsx"))) continue;
    const score = draftFileCount(slug, sessionId);
    if (!best || score > best.score) best = { sessionId, score };
  }
  return best?.sessionId;
}

function resolveSessionsFromBatch(): Map<string, string> {
  const best = new Map<string, { sessionId: string; score: number; completedAt: string }>();
  if (!existsSync(BATCH_STATE)) return new Map();

  const state = JSON.parse(readFileSync(BATCH_STATE, "utf8")) as BatchState;
  for (const job of state.jobs) {
    if (job.status !== "complete" || !job.sessionId) continue;
    const slug = JOBS.find((j) => j.route === job.route)?.slug;
    if (!slug) continue;
    const score = draftFileCount(slug, job.sessionId);
    const completedAt = job.completedAt ?? "";
    const existing = best.get(job.route);
    if (
      !existing ||
      score > existing.score ||
      (score === existing.score && completedAt > existing.completedAt)
    ) {
      best.set(job.route, { sessionId: job.sessionId, score, completedAt });
    }
  }

  return new Map([...best.entries()].map(([route, v]) => [route, v.sessionId]));
}

function resolveSessionForJob(job: RouteJob): string | undefined {
  const fromBatch = resolveSessionsFromBatch().get(job.route);
  const fromDrafts = bestSessionForSlug(job.slug);
  if (!fromBatch) return fromDrafts;
  if (!fromDrafts) return fromBatch;

  const batchScore = draftFileCount(job.slug, fromBatch);
  const draftScore = draftFileCount(job.slug, fromDrafts);
  return draftScore >= batchScore ? fromDrafts : fromBatch;
}

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else cpSync(from, to);
  }
}

function stripShellFromSource(source: string): string {
  const hasFeatureSubNav =
    /<(Sidebar|AppSidebar|SubNav)[^>]*(page|view|active)=\{/.test(source) ||
    /navigate=\{/.test(source) ||
    /onNavigate=\{/.test(source) ||
    /<AppShell\b/.test(source) ||
    /Feature sub-nav/.test(source);

  let s = source;
  s = s.replace(/^import\s+["']\.?\/?reference\.css["'];?\s*\n/gm, "");

  if (!hasFeatureSubNav) {
    s = s.replace(/^import\s+Sidebar\s+from\s+["'][^"']+["'];\s*\n/gm, "");
    s = s.replace(/^import\s+AppSidebar\s+from\s+["'][^"']+["'];\s*\n/gm, "");
    s = s.replace(/<Sidebar[^>]*\/>\s*/g, "");
    s = s.replace(/<Sidebar[^>]*>[\s\S]*?<\/Sidebar>\s*/g, "");
    s = s.replace(/<AppSidebar[^>]*\/>\s*/g, "");
    s = s.replace(/<AppSidebar[^>]*>[\s\S]*?<\/AppSidebar>\s*/g, "");
    s = s.replace(/<AppShell[^>]*>\s*/g, "");
    s = s.replace(/<\/AppShell>\s*/g, "");
    s = s.replace(/active="[^"]*"\s*/g, "");
  }

  return s;
}

function applyFlowPatches(slug: string, flowName: string, source: string): string {
  if (slug === "campaigns") {
    const usesObjectView = /useState<View>\(\{ name:/.test(source);
    let patched = source.replace(
      `export default function ${flowName}() {`,
      `export type CampaignsInitialView = "list" | "create";

export default function ${flowName}({ initialView = "list" }: { initialView?: CampaignsInitialView }) {`,
    );
    if (usesObjectView) {
      patched = patched.replace(
        `const [view, setView] = useState<View>({ name: "list" });`,
        `const [view, setView] = useState<View>({ name: initialView } as View);`,
      );
    } else {
      patched = patched.replace(
        `const [view, setView] = useState<View>("list");`,
        `const [view, setView] = useState<View>(initialView);`,
      );
    }
    return patched;
  }

  if (slug === "contacts") {
    return source
      .replace(
        `export default function ${flowName}() {`,
        `export type ContactsInitialView = View["name"];

export default function ${flowName}({ initialView = "contacts" }: { initialView?: ContactsInitialView }) {`,
      )
      .replace(
        `const [view, setView] = useState<View>({ name: "contacts" });`,
        `const [view, setView] = useState<View>({ name: initialView } as View);`,
      )
      .replaceAll("Segments", "ChartPie");
  }

  if (slug === "contacts-lists") {
    return source.replace(
      `setView({ name: a === "tools" ? "tools" : a });`,
      `setView({ name: a === "tools" ? "tools" : a } as View);`,
    );
  }

  if (slug === "auto-replies") {
    return source
      .replace(
        `export default function ${flowName}() {`,
        `export type AutoRepliesInitialView = View;

export default function ${flowName}({ initialView = "overview" }: { initialView?: AutoRepliesInitialView }) {`,
      )
      .replace(
        `const [view, setView] = useState<View>("overview");`,
        `const [view, setView] = useState<View>(initialView);`,
      );
  }

  return source;
}

function patchComponentSources(dest: string, flowName: string) {
  const componentsDir = join(dest, "components");
  if (!existsSync(componentsDir)) return;

  for (const file of readdirSync(componentsDir)) {
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    const path = join(componentsDir, file);
    let src = readFileSync(path, "utf8");
    src = src.replace(/from ["']\.\.\/page["']/g, `from "../${flowName}"`);
    src = src.replace(
      /const hasEmoji = \/\[\\u\{1F300\}-\\u\{1FAFF\}[^\]]+\]\.test\(message\);/,
      "const hasEmoji = /[\\u{1F300}-\\u{1FAFF}👗🛍️🖤]/u.test(message);",
    );
    src = src.replaceAll("Segments", "ChartPie");
    writeFileSync(path, src, "utf8");
  }
}

function ensureGlobalsImport(slug: string) {
  const importLine = `@import "../styles/kimi/${slug}.css";`;
  let css = readFileSync(GLOBALS, "utf8");
  if (!css.includes(importLine)) {
    css = css.trimEnd() + `\n${importLine}\n`;
    writeFileSync(GLOBALS, css, "utf8");
  }
}

function integrateJob(job: RouteJob) {
  const sessionId = job.sessionId;
  if (!sessionId) throw new Error(`No session resolved for ${job.route}`);

  const draftDir = join(DRAFTS, job.slug, sessionId);
  if (!existsSync(join(draftDir, "page.tsx"))) {
    throw new Error(`Missing draft page.tsx for ${job.route} at ${draftDir}`);
  }

  const dest = join(KIMI, job.slug);
  const componentsSrc = join(draftDir, "components");
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });

  if (existsSync(componentsSrc)) {
    copyDir(componentsSrc, join(dest, "components"));
  }
  if (existsSync(join(draftDir, "mock-data.ts"))) {
    cpSync(join(draftDir, "mock-data.ts"), join(dest, "mock-data.ts"));
  }
  if (existsSync(join(draftDir, "reference.css"))) {
    mkdirSync(STYLES, { recursive: true });
    cpSync(join(draftDir, "reference.css"), join(STYLES, `${job.slug}.css`));
    ensureGlobalsImport(job.slug);
  }

  let flowSource = readFileSync(join(draftDir, "page.tsx"), "utf8");
  flowSource = stripShellFromSource(flowSource);
  flowSource = flowSource.replace(/export default function \w+/, `export default function ${job.flowName}`);
  flowSource = `/**\n * Kimi session ${sessionId} — UI from Kimi draft (mock data, no backend wiring yet).\n */\n${flowSource}`;
  flowSource = applyFlowPatches(job.slug, job.flowName, flowSource);

  writeFileSync(join(dest, `${job.flowName}.tsx`), flowSource, "utf8");
  patchComponentSources(dest, job.flowName);

  const pageContent = `"use client";

import { Suspense } from "react";
import ${job.flowName} from "@/components/kimi/${job.slug}/${job.flowName}";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="${job.cssClass} text-foreground">
        <${job.flowName} />
      </div>
    </Suspense>
  );
}
`;

  writeFileSync(join(REPO, job.pagePath), pageContent, "utf8");
  console.log(`✓ ${job.route} → ${job.flowName} (${sessionId}, ${draftFileCount(job.slug, sessionId)} files)`);
}

function main() {
  const only = parseArg("--only");

  let jobs = JOBS.map((job) => ({
    ...job,
    sessionId: resolveSessionForJob(job),
  }));

  if (only) {
    const needle = only.replace(/^\//, "");
    jobs = jobs.filter((j) => j.slug.includes(needle) || j.route.includes(needle));
    if (jobs.length === 0) throw new Error(`No job matches --only ${only}`);
  }

  for (const job of jobs) {
    if (!job.sessionId) throw new Error(`No Kimi session for ${job.route}`);
    integrateJob(job);
  }
  console.log(`\nIntegrated ${jobs.length} Kimi UI route(s).\n`);
}

main();
