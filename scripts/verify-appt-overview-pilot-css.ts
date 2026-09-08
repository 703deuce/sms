/**
 * Static CSS audit — no browser, no dev server.
 * Confirms pilot overrides beat purple ref-deco on /appointments/overview.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pilotPath = join(
  process.cwd(),
  "src/components/appointments/kimi-ui/overview/appointments-overview-pilot.css",
);
const pagePath = join(process.cwd(), "src/components/appointments/kimi-ui/overview/page.tsx");

const pilot = readFileSync(pilotPath, "utf8");
const page = readFileSync(pagePath, "utf8");

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [
  {
    name: "page wraps content in appt-overview-pilot",
    ok: page.includes('className="appt-overview-pilot ref-root'),
  },
  {
    name: "pilot CSS loads after reference.css",
    ok: page.indexOf("./reference.css") < page.indexOf("./appointments-overview-pilot.css"),
  },
  {
    name: "charcoal brand token defined",
    ok: pilot.includes("--brand-primary: #1f2329"),
  },
  {
    name: "teal accent token defined",
    ok: pilot.includes("--brand-accent: #147d74"),
  },
  {
    name: "KPI purple gradient overridden with !important",
    ok: pilot.includes(".appt-overview-pilot .ref-deco-kpi--purple::before") && pilot.includes("!important"),
  },
  {
    name: "ref-root --brand forced to teal",
    ok: pilot.includes("--brand: #147d74 !important"),
  },
  {
    name: "purple icon rings neutralized",
    ok: pilot.includes(".appt-overview-pilot .ref-deco-icon-ring--purple") && pilot.includes("!important"),
  },
  {
    name: "chart dot uses teal accent",
    ok: pilot.includes(".appt-overview-pilot .chart-dot") && pilot.includes("var(--brand-accent)"),
  },
  {
    name: "no purple hex in pilot KPI override block",
    ok: !/Force pilot palette[\s\S]*#6366f1/.test(pilot) && !/Force pilot palette[\s\S]*#4f46e5/.test(pilot),
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
