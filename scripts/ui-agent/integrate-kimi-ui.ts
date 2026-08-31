/**
 * Promote Kimi draft UI into src/components/kimi/<slug>/ and wire route pages (mock only).
 *
 *   npx tsx scripts/ui-agent/integrate-kimi-ui.ts
 *   npx tsx scripts/ui-agent/integrate-kimi-ui.ts --only contacts
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const REPO = process.cwd();
const DRAFTS = join(REPO, "src/kimi-drafts");
const KIMI = join(REPO, "src/components/kimi");
const STYLES = join(REPO, "src/styles/kimi");
const GLOBALS = join(REPO, "src/app/globals.css");

type RouteJob = {
  route: string;
  slug: string;
  sessionId: string;
  flowName: string;
  pagePath: string;
  cssClass: string;
};

const JOBS: RouteJob[] = [
  {
    route: "/auto-replies",
    slug: "auto-replies",
    sessionId: "2026-08-31T00-26-52-701Z-4d9b2f",
    flowName: "AutoRepliesFlow",
    pagePath: "src/app/(app)/auto-replies/page.tsx",
    cssClass: "kimi-auto-replies",
  },
  {
    route: "/campaigns",
    slug: "campaigns",
    sessionId: "2026-08-31T00-27-02-999Z-ad1c3f",
    flowName: "CampaignsUiFlow",
    pagePath: "src/app/(app)/campaigns/page.tsx",
    cssClass: "kimi-campaigns",
  },
  {
    route: "/contacts",
    slug: "contacts",
    sessionId: "2026-08-31T00-27-02-745Z-325a4c",
    flowName: "ContactsFlow",
    pagePath: "src/app/(app)/contacts/page.tsx",
    cssClass: "kimi-contacts",
  },
  {
    route: "/contacts/fields",
    slug: "contacts-fields",
    sessionId: "2026-08-31T00-27-02-630Z-e3a6eb",
    flowName: "ContactsFieldsFlow",
    pagePath: "src/app/(app)/contacts/fields/page.tsx",
    cssClass: "kimi-contacts-fields",
  },
  {
    route: "/contacts/lists",
    slug: "contacts-lists",
    sessionId: "2026-08-31T00-27-02-830Z-a189c0",
    flowName: "ContactsListsFlow",
    pagePath: "src/app/(app)/contacts/lists/page.tsx",
    cssClass: "kimi-contacts-lists",
  },
  {
    route: "/conversations",
    slug: "conversations",
    sessionId: "2026-08-31T00-27-03-004Z-da00ac",
    flowName: "ConversationsFlow",
    pagePath: "src/app/(app)/conversations/page.tsx",
    cssClass: "kimi-conversations",
  },
  {
    route: "/grow/keywords",
    slug: "grow-keywords",
    sessionId: "2026-08-31T00-27-03-081Z-938e13",
    flowName: "GrowKeywordsFlow",
    pagePath: "src/app/(app)/grow/keywords/page.tsx",
    cssClass: "kimi-grow-keywords",
  },
  {
    route: "/grow/qr-codes",
    slug: "grow-qr-codes",
    sessionId: "2026-08-31T00-27-02-641Z-bd7a3c",
    flowName: "GrowQrCodesFlow",
    pagePath: "src/app/(app)/grow/qr-codes/page.tsx",
    cssClass: "kimi-grow-qr-codes",
  },
  {
    route: "/grow/tap-to-join",
    slug: "grow-tap-to-join",
    sessionId: "2026-08-31T00-27-02-636Z-5893e5",
    flowName: "GrowTapToJoinFlow",
    pagePath: "src/app/(app)/grow/tap-to-join/page.tsx",
    cssClass: "kimi-grow-tap-to-join",
  },
  {
    route: "/messaging/media",
    slug: "messaging-media",
    sessionId: "2026-08-31T00-27-02-964Z-35e7b9",
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
  let s = source;
  s = s.replace(/^import\s+Sidebar\s+from\s+["'][^"']+["'];\s*\n/gm, "");
  s = s.replace(/^import\s+AppSidebar\s+from\s+["'][^"']+["'];\s*\n/gm, "");
  s = s.replace(/^import\s+AppShell\s+from\s+["'][^"']+["'];\s*\n/gm, "");
  s = s.replace(/^import\s+["']\.?\/?reference\.css["'];\s*\n/gm, "");
  s = s.replace(/<Sidebar[^>]*\/>\s*/g, "");
  s = s.replace(/<Sidebar[^>]*>[\s\S]*?<\/Sidebar>\s*/g, "");
  s = s.replace(/<AppSidebar[^>]*\/>\s*/g, "");
  s = s.replace(/<AppSidebar[^>]*>[\s\S]*?<\/AppSidebar>\s*/g, "");
  s = s.replace(/<AppShell[^>]*>\s*/g, "");
  s = s.replace(/<\/AppShell>\s*/g, "");
  s = s.replace(/active="[^"]*"\s*/g, "");
  s = s.replace(/export default function ReferencePage/g, "export default function KimiFlow");
  s = s.replace(/export default function CampaignsPage/g, "export default function KimiFlow");
  return s;
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
  const draftDir = join(DRAFTS, job.slug, job.sessionId);
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
  flowSource = flowSource.replace(
    /export default function KimiFlow/,
    `/**\n * Kimi session ${job.sessionId} — UI from Kimi draft (mock data, no backend wiring yet).\n */\nexport default function ${job.flowName}`,
  );

  writeFileSync(join(dest, `${job.flowName}.tsx`), flowSource, "utf8");

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
  console.log(`✓ ${job.route} → ${job.flowName} (${job.sessionId})`);
}

function main() {
  const only = parseArg("--only");
  let jobs = JOBS;
  if (only) {
    jobs = jobs.filter((j) => j.slug.includes(only) || j.route.includes(only));
    if (jobs.length === 0) throw new Error(`No job matches --only ${only}`);
  }
  for (const job of jobs) integrateJob(job);
  console.log(`\nIntegrated ${jobs.length} Kimi UI route(s).\n`);
}

main();
