/**
 * Read-only GET smoke for Power Dialer / native CRM / public v1 APIs and app pages.
 * Usage: BASE_URL=http://localhost:3000 npx tsx scripts/smoke-power-dialer-get-routes.ts
 */
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

type RouteSpec = {
  path: string;
  kind: "api" | "page" | "v1";
  note?: string;
};

const PLACEHOLDER = "000000000000000000000000";

const API_GETS: RouteSpec[] = [
  { path: "/api/phone/power-dialer/overview", kind: "api" },
  { path: "/api/phone/power-dialer/settings", kind: "api" },
  { path: "/api/phone/power-dialer/compliance", kind: "api" },
  { path: "/api/phone/power-dialer/dial-modes", kind: "api" },
  { path: "/api/phone/power-dialer/analytics?range=7d", kind: "api" },
  { path: "/api/phone/power-dialer/analytics/live-board", kind: "api" },
  { path: "/api/phone/power-dialer/analytics/scheduled-reports", kind: "api" },
  { path: "/api/phone/power-dialer/analytics/export?days=7", kind: "api" },
  { path: "/api/phone/power-dialer/number-health", kind: "api" },
  { path: "/api/phone/power-dialer/team", kind: "api" },
  { path: "/api/phone/power-dialer/campaigns", kind: "api" },
  { path: "/api/phone/power-dialer/campaigns/table", kind: "api" },
  { path: `/api/phone/power-dialer/campaigns/${PLACEHOLDER}`, kind: "api", note: "expect 404|400" },
  { path: "/api/phone/power-dialer/lists", kind: "api" },
  { path: `/api/phone/power-dialer/lists/${PLACEHOLDER}`, kind: "api", note: "expect 404|400" },
  { path: "/api/phone/power-dialer/lists/crm-sources", kind: "api" },
  { path: "/api/phone/power-dialer/scripts", kind: "api" },
  { path: "/api/phone/power-dialer/dispositions", kind: "api" },
  { path: "/api/phone/power-dialer/voicemail-drops", kind: "api" },
  { path: "/api/phone/power-dialer/cadences", kind: "api" },
  { path: "/api/phone/power-dialer/callbacks", kind: "api" },
  { path: "/api/phone/power-dialer/sessions", kind: "api", note: "expect 405" },
  { path: "/api/phone/power-dialer/session-presets", kind: "api" },
  { path: "/api/phone/power-dialer/workspace-members", kind: "api" },
  { path: "/api/phone/power-dialer/integrations", kind: "api" },
  { path: "/api/phone/power-dialer/integrations/sync-history", kind: "api" },
  { path: "/api/phone/power-dialer/ai-callbacks", kind: "api", note: "expect 405" },
  { path: "/api/phone/power-dialer/impersonation", kind: "api" },
  { path: "/api/phone/power-dialer/developer/api-keys", kind: "api" },
  { path: "/api/phone/power-dialer/developer/webhooks", kind: "api" },
  { path: "/api/crm/native/views", kind: "api" },
  { path: "/api/crm/native/folders", kind: "api" },
  { path: "/api/crm/native/contacts?q=&page=1&pageSize=100", kind: "api" },
  { path: "/api/crm/native/companies", kind: "api" },
  { path: "/api/crm/native/deals", kind: "api" },
  { path: "/api/crm/native/tasks?bucket=due", kind: "api" },
  { path: "/api/crm/native/appointments", kind: "api" },
  { path: "/api/crm/native/custom-fields", kind: "api" },
  { path: "/api/crm/native/settings", kind: "api" },
  { path: "/api/crm/native/deal-stages", kind: "api" },
  { path: "/api/crm/native/contacts/duplicates", kind: "api" },
  { path: "/api/v1/power-dialer/campaigns", kind: "v1" },
  { path: "/api/v1/power-dialer/lists", kind: "v1" },
  { path: "/api/v1/power-dialer/contacts", kind: "v1" },
  { path: "/api/v1/power-dialer/sessions", kind: "v1" },
  { path: "/api/v1/power-dialer/attempts", kind: "v1" },
  { path: "/api/v1/power-dialer/callbacks", kind: "v1" },
  { path: "/api/v1/power-dialer/tasks", kind: "v1" },
  { path: "/api/v1/power-dialer/dispositions", kind: "v1" },
  { path: "/api/v1/power-dialer/dnc", kind: "v1" },
  { path: "/api/v1/power-dialer/webhooks", kind: "v1" },
  { path: "/api/v1/zapier/polling/contacts", kind: "v1" },
  { path: "/api/v1/zapier/polling/dispositions", kind: "v1" },
];

const PAGES: RouteSpec[] = [
  { path: "/app/power-dialer", kind: "page" },
  { path: "/app/power-dialer/analytics", kind: "page" },
  { path: "/app/power-dialer/analytics/campaigns", kind: "page" },
  { path: "/app/power-dialer/analytics/representatives", kind: "page" },
  { path: "/app/power-dialer/analytics/numbers", kind: "page" },
  { path: "/app/power-dialer/analytics/screening", kind: "page" },
  { path: "/app/power-dialer/analytics/usage", kind: "page" },
  { path: "/app/power-dialer/settings", kind: "page" },
  { path: "/app/power-dialer/campaigns", kind: "page" },
  { path: "/app/power-dialer/calling-lists", kind: "page" },
  { path: "/app/power-dialer/call-history", kind: "page" },
  { path: "/app/power-dialer/callbacks", kind: "page" },
  { path: "/app/power-dialer/dialer", kind: "page" },
  { path: "/app/power-dialer/number-health", kind: "page" },
  { path: "/app/power-dialer/integrations", kind: "page" },
  { path: "/app/contacts", kind: "page" },
  { path: "/app/contacts/companies", kind: "page" },
  { path: "/app/contacts/deals", kind: "page" },
  { path: "/app/contacts/tasks", kind: "page" },
  { path: "/app/contacts/calendar", kind: "page" },
  { path: "/app/contacts/settings", kind: "page" },
];

function okStatus(status: number, kind: RouteSpec["kind"], note?: string): boolean {
  if (status >= 500) return false;
  if (kind === "v1") return status === 401;
  if (status >= 200 && status < 300) return true;
  if (kind === "page" && (status === 307 || status === 308)) return true;
  if (status === 404 && note?.includes("404")) return true;
  if (status === 400 && note?.includes("400")) return true;
  if (status === 404 && kind === "api") return true;
  if (status === 405 && note?.includes("405")) return true;
  return false;
}

async function hit(spec: RouteSpec): Promise<{ status: number; bodySnippet: string }> {
  const url = `${base}${spec.path}`;
  const res = await fetch(url, { method: "GET", redirect: "manual" });
  const text = await res.text();
  const snippet = text.slice(0, 120).replace(/\s+/g, " ");
  return { status: res.status, bodySnippet: snippet };
}

async function main() {
  const rows: { path: string; status: number; ok: string; note: string }[] = [];
  let fail = 0;
  for (const spec of [...API_GETS, ...PAGES]) {
    let status = 0;
    let snippet = "";
    try {
      const r = await hit(spec);
      status = r.status;
      snippet = r.bodySnippet;
    } catch (e) {
      status = 0;
      snippet = e instanceof Error ? e.message : "fetch failed";
    }
    const pass = okStatus(status, spec.kind, spec.note);
    if (!pass) fail += 1;
    rows.push({
      path: spec.path,
      status,
      ok: pass ? "PASS" : "FAIL",
      note: spec.note || spec.kind,
    });
    if (!pass) {
      console.error(`FAIL ${spec.path} → ${status} ${snippet}`);
    }
  }

  console.log("\n| Path | Status | Result | Kind |");
  console.log("|------|--------|--------|------|");
  for (const r of rows) {
    console.log(`| ${r.path} | ${r.status} | ${r.ok} | ${r.note} |`);
  }
  console.log(`\nTotal: ${rows.length}, failed: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
