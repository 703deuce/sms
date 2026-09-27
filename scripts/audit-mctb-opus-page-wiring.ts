/**
 * Static inventory: MCTB Opus (Stage 2) routes vs data sources.
 * Run: npx tsx scripts/audit-mctb-opus-page-wiring.ts
 */
type Row = {
  route: string;
  connected: string;
  dataSource: string;
  savesToRuntime: string;
  notes?: string;
};

const INVENTORY: Row[] = [
  {
    route: "/mctb",
    connected: "overview-page.tsx",
    dataSource: "SSR loadMctbOverview + /api/mctb/overview-enrichment",
    savesToRuntime: "— (read-only)",
  },
  {
    route: "/mctb/missed-calls",
    connected: "missed-calls-page.tsx",
    dataSource: "/api/mctb/missed-calls (client refetch)",
    savesToRuntime: "Row exclusion → POST /api/mctb/exclusions",
  },
  {
    route: "/mctb/missed-calls/[id]",
    connected: "missed-call-detail-page.tsx",
    dataSource: "GET /api/mctb/missed-calls/:id",
    savesToRuntime: "— (read-only; links to inbox)",
  },
  {
    route: "/mctb/conversations",
    connected: "conversations-page.tsx",
    dataSource: "kimi-inbox-adapter (source=mctb) + /api/mctb/shell-context",
    savesToRuntime: "patchConversation, sendNewMessage → SMS pipeline",
    notes: "MCTB-filtered shared inbox; not generic /conversations shell",
  },
  {
    route: "/mctb/ai-recovery",
    connected: "ai-recovery-page.tsx",
    dataSource: "GET /api/mctb/ai-recovery/context",
    savesToRuntime: "POST /api/mctb/lead-recovery/config (+ booking-links)",
  },
  {
    route: "/mctb/voicemail",
    connected: "voicemail-page.tsx",
    dataSource: "GET /api/phone/voicemail",
    savesToRuntime: "— (operational inbox)",
  },
  {
    route: "/mctb/analytics",
    connected: "analytics-page.tsx",
    dataSource: "SSR loadMctbAnalytics + GET /api/mctb/analytics",
    savesToRuntime: "—",
  },
  {
    route: "/mctb/compliance/consent",
    connected: "consent-history-page.tsx",
    dataSource: "GET /api/mctb/consent-log",
    savesToRuntime: "—",
  },
  {
    route: "/mctb/setup",
    connected: "setup-pages.tsx → overview wiring",
    dataSource: "GET /api/mctb/setup, onboarding, live-test, funnel",
    savesToRuntime: "Pause → POST /api/mctb/setup",
  },
  {
    route: "/mctb/setup/phone",
    connected: "mctb-setup-phone-wiring.ts",
    dataSource: "GET /api/mctb/setup + /api/mctb/onboarding",
    savesToRuntime: "POST /api/mctb/setup, /api/mctb/onboarding (forwarding test)",
  },
  {
    route: "/mctb/setup/consent",
    connected: "consent-editor.tsx",
    dataSource: "GET /api/mctb/setup, /api/mctb/consent-prompt",
    savesToRuntime: "POST /api/mctb/setup (consentMode, attestation)",
  },
  {
    route: "/mctb/setup/text-back",
    connected: "text-back-editor.tsx",
    dataSource: "GET /api/mctb/setup",
    savesToRuntime: "POST /api/mctb/setup (messageTemplate)",
  },
  {
    route: "/mctb/setup/recovery",
    connected: "setup-wiring-hooks useMctbRecoveryWiring",
    dataSource: "GET /api/mctb/setup",
    savesToRuntime: "POST /api/mctb/setup (triggers, pause, cooldown, delay)",
  },
  {
    route: "/mctb/setup/voicemail",
    connected: "useMctbVoicemailWiring",
    dataSource: "GET /api/mctb/setup + /api/phone/voicemail",
    savesToRuntime: "POST /api/phone/voicemail; setup triggerRules",
  },
  {
    route: "/mctb/setup/notifications",
    connected: "useMctbNotificationsWiring",
    dataSource: "GET/POST /api/mctb/handoff",
    savesToRuntime: "POST /api/mctb/handoff",
  },
  {
    route: "/mctb/setup/exclusions",
    connected: "exclusions-table.tsx",
    dataSource: "GET/POST/DELETE /api/mctb/exclusions",
    savesToRuntime: "Exclusions API → send eligibility",
  },
  {
    route: "/mctb/setup/links",
    connected: "useMctbLinksWiring",
    dataSource: "GET /api/mctb/setup",
    savesToRuntime: "POST /api/mctb/setup (defaultLinkUrl, requestForm)",
  },
  {
    route: "/mctb/setup/test",
    connected: "useMctbTestWiring",
    dataSource: "/api/mctb/setup-test, /api/mctb/live-test, /api/mctb/setup",
    savesToRuntime: "POST /api/mctb/live-test (start test)",
  },
];

const FORBIDDEN_IN_CONNECTED = ["sandbox-data", "MOCK_", "DEMO_CHECKS"];

import fs from "node:fs";
import path from "node:path";

function scanDir(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...scanDir(p));
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const connectedRoot = path.join(process.cwd(), "src/newui-transplant/connected/mctb");
const files = scanDir(connectedRoot);
const violations: string[] = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const token of FORBIDDEN_IN_CONNECTED) {
    if (text.includes(token)) violations.push(`${path.relative(process.cwd(), file)} → ${token}`);
  }
}

console.log("# MCTB Opus page wiring inventory\n");
for (const row of INVENTORY) {
  console.log(`## ${row.route}`);
  console.log(`- Connected: \`${row.connected}\``);
  console.log(`- Data: ${row.dataSource}`);
  console.log(`- Runtime writes: ${row.savesToRuntime}`);
  if (row.notes) console.log(`- Notes: ${row.notes}`);
  console.log("");
}

if (violations.length) {
  console.error("FAIL: sandbox/mock tokens in connected MCTB shells:");
  for (const v of violations) console.error(" ", v);
  process.exit(1);
}
console.log("PASS: no sandbox-data imports in connected/mctb");
console.log(`Pages inventoried: ${INVENTORY.length}`);
