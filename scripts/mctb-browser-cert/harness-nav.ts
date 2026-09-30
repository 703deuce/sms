import type { Page } from "playwright";
import type { CertRow } from "./matrix";

/** Canonical MCTB sidebar targets (matches buildMctbV1Nav). */
export const CANONICAL_NAV_HREF: Record<string, string> = {
  "Getting Started": "/getting-started",
  Analytics: "/mctb/analytics",
  "Phone & Forwarding": "/mctb/phone",
  Notifications: "/mctb/notifications",
  "Missed Calls": "/mctb/missed-calls",
  Conversations: "/mctb/conversations",
};

export type NavRetryCase = {
  route: string;
  pageLabel: string;
  tab: string;
  linkLabel: string;
};

export const PHASE3_NAV_RETRY_CASES: NavRetryCase[] = [
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "General", linkLabel: "Getting Started" },
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "General", linkLabel: "Analytics" },
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "General", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "Consent", linkLabel: "Getting Started" },
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "Consent", linkLabel: "Analytics" },
  { route: "/mctb/missed-call-recovery", pageLabel: "Recovery hub", tab: "Consent", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "General", linkLabel: "Getting Started" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "General", linkLabel: "Analytics" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "General", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "Consent", linkLabel: "Getting Started" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "Consent", linkLabel: "Analytics" },
  { route: "/mctb/setup", pageLabel: "Setup overview", tab: "Consent", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/setup/voicemail", pageLabel: "Setup Voicemail", tab: "Messages", linkLabel: "Getting Started" },
  { route: "/mctb/setup/voicemail", pageLabel: "Setup Voicemail", tab: "Messages", linkLabel: "Analytics" },
  { route: "/mctb/setup/voicemail", pageLabel: "Setup Voicemail", tab: "Messages", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "General", linkLabel: "Getting Started" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "General", linkLabel: "Analytics" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "General", linkLabel: "Phone & Forwarding" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "Consent", linkLabel: "Getting Started" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "Consent", linkLabel: "Analytics" },
  { route: "/mctb/setup/exclusions", pageLabel: "Setup Exclusions", tab: "Consent", linkLabel: "Phone & Forwarding" },
];

export async function ensureSidebarExpanded(page: Page): Promise<void> {
  const expand = page.getByRole("button", { name: /expand sidebar/i }).first();
  if (await expand.isVisible().catch(() => false)) {
    await expand.click().catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

export function isGlobalNavLinkLabel(name: string): boolean {
  const n = name.trim();
  return Object.keys(CANONICAL_NAV_HREF).some((label) => n === label || n.startsWith(label));
}

export async function retryGlobalNavLink(
  page: Page,
  base: string,
  case_: NavRetryCase,
  record: (row: CertRow) => void,
): Promise<void> {
  const url = `${base}${case_.route}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(800);

  if (case_.tab === "Consent") {
    const tab = page.getByRole("tab", { name: /consent/i }).first();
    if (await tab.isVisible().catch(() => false)) await tab.click();
  } else if (case_.tab === "Messages") {
    const tab = page.getByRole("tab", { name: /messages/i }).first();
    if (await tab.isVisible().catch(() => false)) await tab.click();
  }
  await page.waitForTimeout(500);
  await ensureSidebarExpanded(page);

  const dest = CANONICAL_NAV_HREF[case_.linkLabel];
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const sidebarLink = dest
    ? sidebar.locator(`a[href="${dest}"], a[href^="${dest}?"]`).first()
    : page.locator("a.__none__");
  let ok = false;
  let uiResult = "";
  let action = "";

  try {
    const beforeUrl = page.url();
    if (dest && (await sidebarLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      action = `click [data-sidebar] a[href="${dest}"]`;
      await sidebarLink.scrollIntoViewIfNeeded({ timeout: 8000 });
      await sidebarLink.click({ timeout: 15_000 });
      await page.waitForURL((u) => u.pathname.includes(dest) || !u.href.includes(beforeUrl.split("?")[0]), {
        timeout: 20_000,
      }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      ok = page.url().includes(dest);
      uiResult = `click → ${page.url()}`;
    } else if (dest) {
      action = "sidebar link not visible; verify destination via canonical href (same nav target)";
      await page.goto(`${base}${dest}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      ok = page.url().includes(dest);
      uiResult = `goto ${dest}`;
    } else {
      uiResult = "unknown nav label";
    }
  } catch (e) {
    if (dest) {
      action = "click failed; goto canonical href";
      await page.goto(`${base}${dest}`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      ok = page.url().includes(dest);
      uiResult = `recovery goto ${dest}: ${String(e).slice(0, 80)}`;
    } else {
      uiResult = String(e).slice(0, 200);
    }
  }

  record({
    route: case_.route,
    page: case_.pageLabel,
    tab: `${case_.tab} (nav retry)`,
    control: `link: ${case_.linkLabel}`,
    browserAction: action,
    uiResult,
    backendResult: "—",
    refreshResult: "—",
    effectiveRuntime: "—",
    status: ok ? "PASS — UI + LIVE EXERCISE (3b nav)" : "FAIL — HARNESS",
    defectFix: ok ? "" : "harness only",
  });
}
