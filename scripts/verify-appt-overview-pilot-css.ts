/**
 * Static CSS audit — no browser, no dev server.
 * Confirms 60-30-10 canvas/graphite/violet pilot on /appointments/overview.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pilotPath = join(
  process.cwd(),
  "src/components/appointments/kimi-ui/overview/appointments-overview-pilot.css",
);
const pagePath = join(process.cwd(), "src/components/appointments/kimi-ui/overview/page.tsx");
const layoutPath = join(process.cwd(), "src/app/(app)/appointments/overview/layout.tsx");
const fontPath = join(process.cwd(), "src/components/appointments/kimi-ui/appointments-pilot-font.ts");

const pilot = readFileSync(pilotPath, "utf8");
const page = readFileSync(pagePath, "utf8");
const layout = readFileSync(layoutPath, "utf8");
const font = readFileSync(fontPath, "utf8");

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [
  {
    name: "page wraps content in appt-overview-pilot",
    ok: page.includes('className="appt-overview-pilot ref-root'),
  },
  {
    name: "pilot CSS loaded from overview layout",
    ok: layout.includes("appointments-overview-pilot.css"),
  },
  {
    name: "IBM Plex Sans shared font module used in layout",
    ok: layout.includes("appointments-pilot-font") && font.includes("IBM_Plex_Sans"),
  },
  {
    name: "canvas token defined (#F7F7F5)",
    ok: pilot.includes("--canvas: #f7f7f5"),
  },
  {
    name: "graphite brand token defined (#181B1F)",
    ok: pilot.includes("--brand-primary: #181b1f"),
  },
  {
    name: "violet accent token defined (#6B5DD3)",
    ok: pilot.includes("--brand-accent: #6b5dd3"),
  },
  {
    name: "semantic success green separated from accent",
    ok: pilot.includes("--state-success: #248a5a"),
  },
  {
    name: "KPI purple gradient overridden with !important",
    ok: pilot.includes(".appt-overview-pilot .ref-deco-kpi--purple::before") && pilot.includes("!important"),
  },
  {
    name: "ref-root --brand forced to violet",
    ok: pilot.includes("--brand: #6b5dd3 !important"),
  },
  {
    name: "purple icon rings neutralized",
    ok: pilot.includes(".appt-overview-pilot .ref-deco-icon-ring--purple") && pilot.includes("!important"),
  },
  {
    name: "chart dot uses violet accent",
    ok: pilot.includes(".appt-overview-pilot .chart-dot") && pilot.includes("var(--brand-accent)"),
  },
  {
    name: "section accent bars stay graphite (not accent flood)",
    ok:
      pilot.includes(".appt-overview-pilot .ref-deco-section-accent--green") &&
      pilot.includes("background: var(--brand-primary) !important"),
  },
  {
    name: "active status uses semantic green",
    ok: pilot.includes(".appt-pilot-status-active") && pilot.includes("var(--state-success)"),
  },
  {
    name: "full-page shell html class hook exists",
    ok: readFileSync(
      join(process.cwd(), "src/components/appointments/kimi-ui/overview/appointments-overview-pilot-chrome.tsx"),
      "utf8",
    ).includes("appt-overview-pilot-active"),
  },
  {
    name: "shell sidebar nav overrides present",
    ok: pilot.includes('html.appt-overview-pilot-active .transovo-nav-item[data-active="true"]'),
  },
  {
    name: "page title scale is 22px",
    ok: pilot.includes("--type-page-title: 1.375rem"),
  },
  {
    name: "body scale is 14px / 20px line-height",
    ok: pilot.includes("--type-body: 0.875rem") && pilot.includes("--type-body-line: 1.25rem"),
  },
  {
    name: "IBM Plex applied on html pilot root",
    ok: pilot.includes("html.appt-overview-pilot-active") && pilot.includes("--font-appt-overview-pilot"),
  },
  {
    name: "shell logo indigo override present",
    ok: pilot.includes("html.appt-overview-pilot-active .transovo-sidebar .bg-indigo-600"),
  },
];

let failed = 0;
for (const c of checks) {
  const mark = c.ok ? "PASS" : "FAIL";
  if (!c.ok) failed++;
  console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} static checks passed.`);
